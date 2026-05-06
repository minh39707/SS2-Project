const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const { applyCharacterProgress } = require("../utils/habitProgress");
const { buildUserAnalyticsPayload } = require("../utils/userAnalytics");
const { callAiModel, getDefaultTaskModel } = require("../services/aiProvider");
const { buildQuestPrompt } = require("../utils/aiPrompts");
const { normalizeQuestDraft } = require("../utils/aiSchemas");

const router = express.Router();
const DEFAULT_TASK_MODEL = getDefaultTaskModel();

function normalizeUserQuest(uq) {
  const quest = uq.quest ?? {};

  return {
    userQuestId: uq.user_quest_id ?? uq.id,
    questId: uq.quest_id,
    title: quest.title ?? "",
    description: quest.description ?? "",
    difficulty: quest.difficulty ?? "normal",
    expReward: quest.exp_reward ?? 0,
    goldReward: quest.gold_reward ?? 0,
    hpReward: quest.hp_reward ?? 0,
    targetCount: uq.target ?? quest.target_count ?? quest.duration_days ?? 1,
    icon: quest.icon ?? "flag-outline",
    progress: uq.progress,
    status: uq.status,
    acceptedAt: uq.started_at ?? uq.accepted_at,
  };
}

async function loadAnalyticsHabits(userId) {
  const { data, error } = await supabase
    .from("habits")
    .select(
      "habit_id, category_id, title, description, habit_type, frequency_type, frequency_days, target_value, target_unit, is_active, created_at",
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsLogs(userId) {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("habit_id, log_date, status, exp_change, hp_change")
    .eq("user_id", userId)
    .order("log_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsCategoryLabels() {
  const { data, error } = await supabase
    .from("habit_categories")
    .select("category_id, name");

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((category) => [category.category_id, category.name]),
  );
}

async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, username, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadCharacter(userId) {
  const { data, error } = await supabase
    .from("characters")
    .select(
      "character_id, level, class, current_hp, max_hp, current_exp, exp_to_next_level, gold_coins",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadActiveUserQuestCount(userId) {
  const { count, error } = await supabase
    .from("user_quests")
    .select("user_quest_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getQuestTypeInsertValue() {
  const { data } = await supabase
    .from("quests")
    .select("quest_type")
    .not("quest_type", "is", null)
    .limit(1);

  return data?.[0]?.quest_type ?? null;
}

async function insertAiQuest(draft) {
  const basePayload = {
    title: draft.title,
    description: draft.description,
    is_ai_generated: true,
    exp_reward: draft.exp_reward,
    gold_reward: draft.gold_reward,
    hp_reward: 0,
    target_count: draft.target,
    duration_days: draft.duration_days,
    icon: "sparkles-outline",
    is_active: true,
  };
  const existingQuestType = await getQuestTypeInsertValue();
  const questTypeCandidates = [
    existingQuestType,
    "side",
    "daily",
    "weekly",
    "challenge",
    "habit",
    "system",
    "ai",
    "custom",
    "main",
  ].filter(Boolean);
  let lastError = null;

  for (const questType of [...new Set(questTypeCandidates)]) {
    const { data, error } = await supabase
      .from("quests")
      .insert({ ...basePayload, quest_type: questType })
      .select("*")
      .single();

    if (!error && data) {
      return { quest: data, error: null };
    }

    lastError = error;

    if (!["22P02", "23502"].includes(error?.code)) {
      break;
    }
  }

  return { quest: null, error: lastError };
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
      positive: habits.filter((habit) => habit.habit_type !== "negative").length,
      negative: habits.filter((habit) => habit.habit_type === "negative").length,
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

function getWeekStartDateKey(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

async function buildAiQuestDraft(userId) {
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
    period: "week",
  });
  const snapshot = buildQuestSnapshot({
    user,
    character,
    habits,
    analytics,
    activeQuestCount,
  });
  const response = await callAiModel({
    model: DEFAULT_TASK_MODEL,
    prompt: buildQuestPrompt({ snapshot }),
    systemInstruction: [
      "You draft RPG-style habit quests for an existing habit tracker app.",
      "Return JSON only.",
      "Do not claim database writes.",
    ].join("\n"),
    temperature: 0.7,
    maxOutputTokens: 1000,
  });

  return {
    draft: normalizeQuestDraft(response.parsed),
    model: response.model,
    snapshot,
  };
}

// GET /api/quests/my
router.get("/my", requireUser, async (req, res) => {
  const { data, error } = await supabase
    .from("user_quests")
    .select("*, quest:quests(*)")
    .eq("user_id", req.userId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    return res.status(500).json({ message: "Failed to load your quests." });
  }

  return res.json({ quests: (data ?? []).map(normalizeUserQuest) });
});

// GET /api/quests/available
router.get("/available", requireUser, async (req, res) => {
  const { data: activeRows, error: activeError } = await supabase
    .from("user_quests")
    .select("quest_id")
    .eq("user_id", req.userId)
    .eq("status", "active");

  if (activeError) {
    return res.status(500).json({ message: "Failed to load available quests." });
  }

  const blockedIds = new Set((activeRows ?? []).map((r) => r.quest_id));
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("is_active", true)
    .order("difficulty", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    return res.status(500).json({ message: "Failed to load available quests." });
  }

  return res.json({
    quests: (data ?? []).filter((quest) => !blockedIds.has(quest.quest_id ?? quest.id)),
  });
});

// POST /api/quests/:quest_id/accept
router.post("/:quest_id/accept", requireUser, async (req, res) => {
  const { quest_id } = req.params;

  const { data: quest, error: questError } = await supabase
    .from("quests")
    .select("*")
    .eq("quest_id", quest_id)
    .eq("is_active", true)
    .single();

  if (questError || !quest) {
    return res.status(404).json({ message: "Quest not found." });
  }

  const { data: existing } = await supabase
    .from("user_quests")
    .select("user_quest_id, status")
    .eq("user_id", req.userId)
    .eq("quest_id", quest_id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ message: "You already have this quest active." });
  }

  const { data: created, error: insertError } = await supabase
    .from("user_quests")
    .insert({
      user_id: req.userId,
      quest_id,
      progress: 0,
      target: quest.target_count ?? quest.duration_days ?? 1,
      status: "active",
    })
    .select("*, quest:quests(*)")
    .single();

  if (insertError) {
    return res.status(500).json({ message: "Failed to accept quest." });
  }

  return res.status(201).json(normalizeUserQuest(created));
});

// POST /api/quests/ai-generate
router.post("/ai-generate", requireUser, async (req, res) => {
  try {
    const { draft, model, snapshot } = await buildAiQuestDraft(req.userId);
    const { quest, error: questError } = await insertAiQuest(draft);

    if (questError || !quest) {
      console.error("AI quest insert error:", questError);
      return res.status(500).json({ message: "Failed to create AI quest." });
    }

    const questId = quest.quest_id ?? quest.id;
    const { data: created, error: acceptError } = await supabase
      .from("user_quests")
      .insert({
        user_id: req.userId,
        quest_id: questId,
        progress: 0,
        target: draft.target,
        status: "active",
      })
      .select("*, quest:quests(*)")
      .single();

    if (acceptError || !created) {
      console.error("AI quest accept error:", acceptError);
      return res.status(500).json({ message: "Failed to accept AI quest." });
    }

    await supabase.from("ai_side_quests").insert({
      user_id: req.userId,
      quest_id: questId,
      generation_prompt: "Generated from weekly user quest snapshot.",
      gemini_model: model,
      behavior_snapshot: snapshot,
      week_start: getWeekStartDateKey(),
    });

    return res.status(201).json({
      quest: normalizeUserQuest(created),
      draft,
    });
  } catch (error) {
    console.error("AI quest creation error:", error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? "Unable to generate AI quest.",
    });
  }
});

// POST /api/quests/:user_quest_id/progress
router.post("/:user_quest_id/progress", requireUser, async (req, res) => {
  const { user_quest_id } = req.params;

  const { data: userQuest, error: loadError } = await supabase
    .from("user_quests")
    .select("*, quest:quests(*)")
    .eq("user_quest_id", user_quest_id)
    .eq("user_id", req.userId)
    .eq("status", "active")
    .single();

  if (loadError || !userQuest) {
    return res.status(404).json({ message: "Active quest not found." });
  }

  const quest = userQuest.quest;
  const newProgress = userQuest.progress + 1;
  const targetCount = userQuest.target ?? quest.target_count ?? quest.duration_days ?? 1;
  const isCompleted = newProgress >= targetCount;

  const { error: updateError } = await supabase
    .from("user_quests")
    .update({
      progress: newProgress,
      ...(isCompleted && { status: "completed", completed_at: new Date().toISOString() }),
    })
    .eq("user_quest_id", user_quest_id);

  if (updateError) {
    return res.status(500).json({ message: "Failed to update quest progress." });
  }

  let character = null;

  if (isCompleted) {
    const { data: charData } = await supabase
      .from("characters")
      .select("*")
      .eq("user_id", req.userId)
      .single();

    if (charData) {
      const updates = applyCharacterProgress(
        charData,
        quest.exp_reward,
        quest.hp_reward,
        quest.gold_reward,
      );

      const { data: updated } = await supabase
        .from("characters")
        .update(updates)
        .eq("user_id", req.userId)
        .select("level, current_exp, current_hp, gold_coins")
        .single();

      character = updated
        ? {
            level: updated.level,
            exp: updated.current_exp,
            hp: updated.current_hp,
            goldCoins: updated.gold_coins,
          }
        : null;
    }
  }

  return res.json({ progress: newProgress, completed: isCompleted, character });
});

// DELETE /api/quests/:user_quest_id
router.delete("/:user_quest_id", requireUser, async (req, res) => {
  const { user_quest_id } = req.params;

  const { error } = await supabase
    .from("user_quests")
    .update({ status: "abandoned" })
    .eq("user_quest_id", user_quest_id)
    .eq("user_id", req.userId)
    .eq("status", "active");

  if (error) {
    return res.status(500).json({ message: "Failed to abandon quest." });
  }

  return res.json({ success: true });
});

module.exports = router;
