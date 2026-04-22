const express = require('express');
const { supabase } = require('../supabase');
const { requireUser } = require('../middleware/auth');
const habitsRouter = require('./habits');
const { buildUserAnalyticsPayload } = require('../utils/userAnalytics');
const { callGemini } = require('../services/gemini');
const {
  callAiModel,
  getAiProvider,
  getDefaultModel,
} = require('../services/aiProvider');
const {
  CHAT_SYSTEM_PROMPT,
  HABIT_CHECKIN_SYSTEM_PROMPT,
  buildSupportChatPrompt,
  buildHabitCheckinPrompt,
  buildQuestPrompt,
  buildInsightPrompt,
  buildAnalyticsReportPrompt,
} = require('../utils/aiPrompts');
const {
  normalizeAnalyticsReport,
  normalizeChatResponse,
  normalizeInsightResponse,
  normalizeQuestDraft,
} = require('../utils/aiSchemas');
const { isNegativeHabit, isPositiveHabit } = require('../utils/habitStatus');
const { toDateKey } = require('../utils/habitProgress');

const router = express.Router();
const habitsAiHelpers = habitsRouter.aiHelpers ?? {};

function normalizeVietnamese(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveRequestedUserId(req) {
  const bodyUserId =
    typeof req.body?.userId === 'string' && req.body.userId.trim()
      ? req.body.userId.trim()
      : null;

  if (bodyUserId && bodyUserId !== req.userId) {
    const error = new Error('userId does not match the authenticated user.');
    error.statusCode = 403;
    throw error;
  }

  return req.userId;
}

function classifyChatMode(message) {
  const normalizedMessage = normalizeVietnamese(message);

  if (!normalizedMessage) {
    return 'support_chat';
  }

  const supportSignals = [
    '?',
    'la gi',
    'lam sao',
    'huong dan',
    'giai thich',
    'tai sao',
    'co nghia la gi',
    'loi khuyen',
    'tu van',
    'app nay',
    'feature',
    'tinh nang',
    'streak',
    'exp',
    'hp',
    'analytics',
    'quest',
  ];
  const habitCheckinSignals = [
    'hom nay',
    'minh da',
    'minh vua',
    'minh uong',
    'minh doc',
    'minh tap',
    'minh di bo',
    'minh chua',
    'toi da',
    'toi vua',
    'xong roi',
    'roi',
    'hoan thanh',
    'khong hut',
    'chua hut',
    'phut',
    'gio',
    'ly',
    'coc',
    'lan',
    'km',
    'ml',
    'l ',
  ];

  if (supportSignals.some((signal) => normalizedMessage.includes(signal))) {
    return 'support_chat';
  }

  if (
    habitCheckinSignals.some((signal) => normalizedMessage.includes(signal)) ||
    /\d/.test(normalizedMessage)
  ) {
    return 'habit_checkin';
  }

  return 'support_chat';
}

function isSupportStyleMessage(message) {
  const normalizedMessage = normalizeVietnamese(message);

  if (!normalizedMessage) {
    return false;
  }

  const supportPrefixes = ['xin chao', 'chao', 'hello', 'hi', 'hey'];
  const providerMentions = ['qwen', 'ollama', 'gemma'];

  return (
    supportPrefixes.some((prefix) => normalizedMessage.startsWith(prefix)) ||
    providerMentions.some((provider) => normalizedMessage.includes(provider))
  );
}

function resolveChatMode(req, message) {
  if (req.body?.mode === 'habit_checkin' && !isSupportStyleMessage(message)) {
    return 'habit_checkin';
  }

  return classifyChatMode(message);
}

async function loadChatHabitContext(userId) {
  const { data, error } = await supabase
    .from('habits')
    .select(
      'habit_id, title, habit_type, target_value, target_unit, frequency_type, is_active',
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsHabits(userId) {
  const { data, error } = await supabase
    .from('habits')
    .select(
      'habit_id, category_id, title, description, habit_type, frequency_type, frequency_days, target_value, target_unit, is_active, created_at',
    )
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsLogs(userId) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, status, exp_change, hp_change')
    .eq('user_id', userId)
    .order('log_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsCategoryLabels() {
  const { data, error } = await supabase
    .from('habit_categories')
    .select('category_id, name');

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((category) => [category.category_id, category.name]),
  );
}

async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('user_id, email, username, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadCharacter(userId) {
  const { data, error } = await supabase
    .from('characters')
    .select(
      'character_id, level, class, current_hp, max_hp, current_exp, exp_to_next_level, gold_coins',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadActiveUserQuestCount(userId) {
  const { count, error } = await supabase
    .from('user_quests')
    .select('user_quest_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function findHabitByTitle(habits, habitTitle) {
  const normalizedTargetTitle = normalizeVietnamese(habitTitle);

  return (
    (habits ?? []).find(
      (habit) => normalizeVietnamese(habit?.title) === normalizedTargetTitle,
    ) ?? null
  );
}

function normalizeUnit(value) {
  return normalizeVietnamese(value).replace(/\s+/g, '');
}

function canAutoCompleteFromValue(habit, action) {
  if (!isPositiveHabit(habit)) {
    return false;
  }

  const actionValue = Number(action?.value);
  const targetValue = Number(habit?.target_value);

  if (!Number.isFinite(actionValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return false;
  }

  const actionUnit = normalizeUnit(action?.unit);
  const targetUnit = normalizeUnit(habit?.target_unit);

  if (actionUnit && targetUnit && actionUnit !== targetUnit) {
    return false;
  }

  return actionValue >= targetValue;
}

function buildQuestSnapshot({ user, character, habits, analytics, activeQuestCount }) {
  return {
    profile: user
      ? {
          user_id: user.user_id,
          username: user.username,
          created_at: user.created_at,
        }
      : null,
    character: character
      ? {
          level: character.level,
          class: character.class,
          current_hp: character.current_hp,
          max_hp: character.max_hp,
          current_exp: character.current_exp,
          exp_to_next_level: character.exp_to_next_level,
          gold_coins: character.gold_coins ?? 0,
        }
      : null,
    active_quest_count: activeQuestCount,
    habits: {
      total: habits.length,
      active: habits.filter((habit) => habit.is_active !== false).length,
      positive: habits.filter((habit) => habit.habit_type !== 'negative').length,
      negative: habits.filter((habit) => habit.habit_type === 'negative').length,
      top_habits: (analytics?.topHabits ?? []).slice(0, 3).map((habit) => ({
        title: habit.title,
        habitType: habit.habitType,
        successCount: habit.successCount,
        successRate: habit.successRate,
        currentStreak: habit.currentStreak,
      })),
      weak_habits: (analytics?.topHabits ?? [])
        .slice()
        .sort((leftHabit, rightHabit) => leftHabit.successRate - rightHabit.successRate)
        .slice(0, 3)
        .map((habit) => ({
          title: habit.title,
          habitType: habit.habitType,
          successRate: habit.successRate,
          failedCount: habit.failedCount,
          missedCount: habit.missedCount,
        })),
    },
    analytics_summary: analytics?.summary ?? null,
    range: analytics?.range ?? null,
  };
}

function buildAnalyticsReportSnapshot(analyticsPayload) {
  const summary = analyticsPayload?.summary ?? {};

  return {
    profile: analyticsPayload?.profile
      ? {
          username: analyticsPayload.profile.username,
          created_at: analyticsPayload.profile.created_at,
        }
      : null,
    range: analyticsPayload?.range ?? null,
    player: analyticsPayload?.player ?? null,
    summary: {
      scheduledCount: summary.scheduledCount ?? 0,
      successCount: summary.successCount ?? 0,
      completedCount: summary.completedCount ?? 0,
      missedCount: summary.missedCount ?? 0,
      avoidedCount: summary.avoidedCount ?? 0,
      failedCount: summary.failedCount ?? 0,
      totalExpGained: summary.totalExpGained ?? 0,
      totalHpChange: summary.totalHpChange ?? 0,
      completionRate: summary.completionRate ?? 0,
      avoidanceRate: summary.avoidanceRate ?? 0,
      activeDays: summary.activeDays ?? 0,
      activeHabitCount: summary.activeHabitCount ?? 0,
      activeGlobalStreak: summary.activeGlobalStreak ?? 0,
      bestHabitStreak: summary.bestHabitStreak ?? 0,
      goodHabits: summary.goodHabits ?? null,
      badHabits: summary.badHabits ?? null,
    },
    topHabits: (analyticsPayload?.topHabits ?? []).slice(0, 8).map((habit) => ({
      title: habit.title,
      habitType: habit.habitType,
      successCount: habit.successCount,
      completedCount: habit.completedCount,
      avoidedCount: habit.avoidedCount,
      failedCount: habit.failedCount,
      missedCount: habit.missedCount,
      successRate: habit.successRate,
      currentStreak: habit.currentStreak,
    })),
    weekdayBreakdown: (analyticsPayload?.weekdayBreakdown ?? []).map((day) => ({
      label: day.label,
      successCount: day.successCount,
      completedCount: day.completedCount,
      avoidedCount: day.avoidedCount,
      failedCount: day.failedCount,
    })),
    categoryBreakdown: (analyticsPayload?.categoryBreakdown ?? []).slice(0, 8).map((category) => ({
      label: category.label,
      successCount: category.successCount,
      percentage: category.percentage,
    })),
    streakHabits: (analyticsPayload?.streakHabits ?? []).slice(0, 8).map((habit) => ({
      title: habit.title,
      currentStreak: habit.currentStreak,
      bestStreak: habit.bestStreak,
    })),
  };
}

function buildCheckinExecutionReply(habit, actionType, isAlreadyLogged = false) {
  if (isAlreadyLogged) {
    return `Habit "${habit.title}" đã được ghi nhận cho hôm nay rồi.`;
  }

  if (actionType === 'partial') {
    return `Mình đã ghi nhận tiến độ của "${habit.title}", nhưng chưa đánh dấu hòan thành vì đây mới là cập nhật một phần.`;
  }

  if (actionType === 'avoid_success') {
    return `Mình đã ghi nhận "${habit.title}" là bạn đã tránh thành công 
    m nay.`;
  }

  if (actionType === 'failed') {
    return `Minh da ghi nhan "${habit.title}" la ban chua tranh duoc hom nay.`;
  }

  return `Minh da danh dau hoan thanh "${habit.title}" cho hom nay.`;
}

async function applyHabitCheckinAction(userId, habits, action) {
  const habit = findHabitByTitle(habits, action?.habit_title);

  if (!habit) {
    return {
      clarification_needed: true,
      clarification_question:
        'Minh chua khop duoc chinh xac thoi quen ban muon check-in. Ban noi ro ten habit giup minh nhe?',
    };
  }

  if (action.action === 'partial' && !canAutoCompleteFromValue(habit, action)) {
    return {
      reply: buildCheckinExecutionReply(habit, action.action),
    };
  }

  const targetStatus =
    action.action === 'partial' || action.action === 'complete'
      ? 'completed'
      : action.action === 'avoid_success'
      ? 'avoided'
      : action.action === 'failed'
        ? 'failed'
        : 'completed';

  if (
    (isPositiveHabit(habit) && targetStatus !== 'completed') ||
    (isNegativeHabit(habit) && !['avoided', 'failed'].includes(targetStatus))
  ) {
    return {
      clarification_needed: true,
      clarification_question: `Cach check-in nay chua phu hop voi habit "${habit.title}". Ban thu noi ro hon nhe?`,
    };
  }

  const todayDateKey = toDateKey();
  const { fetchHabitCompletionContext, persistHabitStatus } = habitsAiHelpers;

  if (!fetchHabitCompletionContext || !persistHabitStatus) {
    const error = new Error('Habit AI helpers are unavailable.');
    error.statusCode = 500;
    throw error;
  }

  const { habit: fullHabit, character, existingLogs, todayLog } =
    await fetchHabitCompletionContext(userId, habit.habit_id, todayDateKey);

  if (!fullHabit) {
    return {
      clarification_needed: true,
      clarification_question: 'Minh khong tim thay habit nay trong du lieu hien tai cua ban.',
    };
  }

  if (todayLog?.status === targetStatus) {
    return {
      reply: buildCheckinExecutionReply(fullHabit, action.action, true),
    };
  }

  await persistHabitStatus({
    userId,
    habit: fullHabit,
    character,
    existingLogs,
    todayLog,
    dateKey: todayDateKey,
    status: targetStatus,
    manualOnly: true,
  });

  return {
    reply: buildCheckinExecutionReply(fullHabit, action.action),
  };
}

function buildChatFallback(mode, model, provider) {
  const fallback = normalizeChatResponse(
    mode === 'habit_checkin'
      ? {
          mode: 'habit_checkin',
          intent: 'check_in',
          reply: 'Minh can ban noi ro hon thoi quen ban muon check-in.',
          actions: [],
          clarification_needed: true,
          clarification_question: 'Ban dang muon check-in thoi quen nao vay?',
        }
      : {
          mode: 'support_chat',
          reply:
            'Minh co the ho tro ve cach dung app, streak, EXP, HP, quest va meo xay dung thoi quen.',
          actions: [],
          clarification_needed: false,
          clarification_question: null,
        },
    { defaultMode: mode, availableHabitTitles: [] },
  );

  return {
    ...fallback,
    meta: { model, provider, fallback: true },
  };
}

router.post('/chat', requireUser, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const conversationId =
      typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : null;

    if (!message) {
      return res.status(400).json({ message: 'message is required.' });
    }

    const mode = resolveChatMode(req, message);
    const aiProvider = getAiProvider();
    const habits = mode === 'habit_checkin' ? await loadChatHabitContext(req.userId) : [];
    const availableHabitTitles = habits.map((habit) => habit.title).filter(Boolean);
    const prompt =
      mode === 'habit_checkin'
        ? buildHabitCheckinPrompt({ message, conversationId, habits })
        : buildSupportChatPrompt({ message, conversationId });
    const systemInstruction =
      mode === 'habit_checkin' ? HABIT_CHECKIN_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;

    try {
      const response = await callAiModel({
        model: getDefaultModel('chat'),
        prompt,
        systemInstruction,
        temperature: mode === 'habit_checkin' ? 0.2 : 0.6,
        maxOutputTokens: mode === 'habit_checkin' ? 900 : 700,
      });
      const normalized = normalizeChatResponse(response.parsed, {
        defaultMode: mode,
        availableHabitTitles,
      });

      if (normalized.mode === 'habit_checkin' && !normalized.clarification_needed) {
        const primaryAction = normalized.actions[0] ?? null;

        if (primaryAction) {
          const execution = await applyHabitCheckinAction(req.userId, habits, primaryAction);

          if (execution.clarification_needed) {
            normalized.actions = [];
            normalized.clarification_needed = true;
            normalized.clarification_question = execution.clarification_question;
            normalized.reply = execution.clarification_question;
          } else if (execution.reply) {
            normalized.reply = execution.reply;
          }
        }
      }

      return res.json({
        ...normalized,
        meta: {
          model: response.model,
          provider: response.provider ?? aiProvider,
        },
      });
    } catch (error) {
      console.error('AI chat error:', error);
      const fallback = buildChatFallback(mode, getDefaultModel('chat'), aiProvider);

      return res.json({
        ...fallback,
        meta: {
          ...fallback.meta,
          fallback: true,
          upstreamStatus: error?.statusCode ?? 502,
          error: error?.message ?? 'AI provider request failed.',
        },
      });
    }
  } catch (error) {
    console.error('AI chat route error:', error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? 'Internal server error.',
    });
  }
});

router.post('/quest/generate', requireUser, async (req, res) => {
  try {
    const userId = resolveRequestedUserId(req);
    const [user, character, habits, logs, categoryLabels, activeQuestCount] =
      await Promise.all([
        loadUserProfile(userId),
        loadCharacter(userId),
        loadAnalyticsHabits(userId),
        loadAnalyticsLogs(userId),
        loadAnalyticsCategoryLabels(),
        loadActiveUserQuestCount(userId),
      ]);
    const analytics = buildUserAnalyticsPayload({
      character,
      habits,
      logs,
      categoryLabels,
      period: 'week',
    });
    const snapshot = buildQuestSnapshot({
      user,
      character,
      habits,
      analytics,
      activeQuestCount,
    });
    const response = await callAiModel({
      model: getDefaultModel('task'),
      prompt: buildQuestPrompt({ snapshot }),
      systemInstruction: [
        'You draft RPG-style habit quests for an existing habit tracker app.',
        'Return JSON only.',
        'Do not claim database writes.',
      ].join('\n'),
      temperature: 0.7,
      maxOutputTokens: 1000,
    });

    return res.json(normalizeQuestDraft(response.parsed));
  } catch (error) {
    console.error('AI quest generation error:', error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? 'Unable to generate quest draft.',
    });
  }
});

router.post('/insight', requireUser, async (req, res) => {
  try {
    const userId = resolveRequestedUserId(req);
    const days = Number.parseInt(req.body?.days, 10);

    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ message: 'days must be a positive number.' });
    }

    const [character, habits, logs, categoryLabels] = await Promise.all([
      loadCharacter(userId),
      loadAnalyticsHabits(userId),
      loadAnalyticsLogs(userId),
      loadAnalyticsCategoryLabels(),
    ]);
    const analyticsPayload = buildUserAnalyticsPayload({
      character,
      habits,
      logs,
      categoryLabels,
      days,
    });
    const response = await callAiModel({
      model: getDefaultModel('task'),
      prompt: buildInsightPrompt({ analyticsPayload, days }),
      systemInstruction: [
        'You explain analytics for an RPG habit tracker app in Vietnamese.',
        'Only use facts and numbers from the supplied payload.',
        'Return JSON only.',
      ].join('\n'),
      temperature: 0.3,
      maxOutputTokens: 1000,
    });

    return res.json(normalizeInsightResponse(response.parsed));
  } catch (error) {
    console.error('AI insight error:', error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? 'Unable to generate analytics insight.',
    });
  }
});

router.post('/analytics-report', requireUser, async (req, res) => {
  try {
    const userId = resolveRequestedUserId(req);
    const requestedPeriod =
      typeof req.body?.period === 'string' ? req.body.period.trim().toLowerCase() : 'week';
    const allowedPeriods = new Set(['day', 'week', 'month', 'year']);
    const period = allowedPeriods.has(requestedPeriod) ? requestedPeriod : 'week';

    const [character, habits, logs, categoryLabels] = await Promise.all([
      loadCharacter(userId),
      loadAnalyticsHabits(userId),
      loadAnalyticsLogs(userId),
      loadAnalyticsCategoryLabels(),
    ]);
    const analyticsPayload = buildUserAnalyticsPayload({
      character,
      habits,
      logs,
      categoryLabels,
      period,
    });
    const reportSnapshot = buildAnalyticsReportSnapshot(analyticsPayload);
    const response = await callGemini({
      model: process.env.GEMINI_REPORT_MODEL || 'gemini-2.0-flash',
      prompt: buildAnalyticsReportPrompt({ analyticsPayload: reportSnapshot, period }),
      systemInstruction: [
        'You write concise analytics reports for a habit tracker app in Vietnamese.',
        'Only use facts and numbers from the supplied payload.',
        'Return JSON only.',
      ].join('\n'),
      temperature: 0.25,
      maxOutputTokens: 1400,
    });

    return res.json({
      report: normalizeAnalyticsReport(response.parsed),
      analytics: analyticsPayload,
      meta: {
        model: response.model,
        provider: response.provider ?? 'gemini',
      },
    });
  } catch (error) {
    console.error('AI analytics report error:', error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? 'Unable to generate analytics report.',
    });
  }
});

module.exports = router;
