const CHAT_SYSTEM_PROMPT = [
  'You are the AI assistant for an RPG habit tracker mobile app.',
  'The app already supports habits, streaks, EXP, HP, levels, focus mode for time-based habits, analytics, quests, and an AI coach bubble.',
  'Always answer in natural Vietnamese.',
  'Do not invent unsupported product features.',
  'Never claim that you wrote to the database or completed a server action.',
  'When asked for support or coaching, be concise, practical, and friendly.',
].join('\n');

const HABIT_CHECKIN_SYSTEM_PROMPT = [
  'You are the structured habit check-in parser for an RPG habit tracker app.',
  'Always answer in Vietnamese.',
  'You never write to the database.',
  'You only draft candidate actions for backend validation.',
  'Never invent habit IDs.',
  'Only map to habit titles that exist in the provided habit context.',
  'If the user message is ambiguous or does not clearly match a single habit, set clarification_needed=true, actions=[] and ask a short clarification question.',
  'Return JSON only.',
].join('\n');

function buildHabitList(habits = []) {
  if (!habits.length) {
    return '[]';
  }

  return JSON.stringify(
    habits.map((habit) => ({
      title: habit.title,
      habit_type: habit.habit_type,
      target_value: Number(habit.target_value ?? 1),
      target_unit: habit.target_unit ?? 'times',
      frequency_type: habit.frequency_type ?? 'daily',
    })),
    null,
    2,
  );
}

function buildSupportChatPrompt({ message, conversationId = null }) {
  return [
    'Task: reply as support_chat.',
    'The user may ask about app support, features, streaks, EXP/HP/levels, onboarding, habit-building advice, check-ins, quests, or analytics explanation.',
    'If the message looks like a check-in attempt, do not convert it into a database action here. Instead briefly ask them to use a clearer check-in message.',
    'Return strict JSON with this shape:',
    JSON.stringify({
      mode: 'support_chat',
      intent: 'optional string',
      reply: 'string',
      actions: [],
      clarification_needed: false,
      clarification_question: null,
    }, null, 2),
    `conversationId: ${conversationId ?? 'null'}`,
    `user_message: ${JSON.stringify(String(message ?? ''))}`,
  ].join('\n\n');
}

function buildHabitCheckinPrompt({ message, conversationId = null, habits = [] }) {
  return [
    'Task: classify this message as a habit_checkin and extract candidate actions.',
    'Allowed action values:',
    '- complete: user clearly completed a positive habit target',
    '- partial: user made progress but did not clearly complete the full target',
    '- failed: user admits doing a negative habit or failing to avoid it',
    '- avoid_success: user clearly avoided a negative habit',
    'Rules:',
    '- never invent habit IDs',
    '- only use habit_title values from the provided context',
    '- if multiple habits could match, ask a clarification question',
    '- if the user says something vague like "Mình hoàn thành rồi", ask which habit',
    '- if the user message is only a habit title/name after a clarification, treat it as choosing that habit for check-in',
    '- for a positive habit title/name selection, use action=complete',
    '- for a negative habit title/name selection, ask whether they avoided it or failed today unless the message clearly says so',
    '- value should be numeric when the user explicitly gives a number, otherwise null',
    '- unit should be the user-provided unit when clear, otherwise null',
    'Return strict JSON with this shape:',
    JSON.stringify({
      mode: 'habit_checkin',
      intent: 'check_in',
      reply: 'string',
      actions: [
        {
          type: 'habit_checkin',
          habit_title: 'string',
          action: 'complete',
          value: 2,
          unit: 'cốc',
        },
      ],
      clarification_needed: false,
      clarification_question: null,
    }, null, 2),
    `conversationId: ${conversationId ?? 'null'}`,
    `user_message: ${JSON.stringify(String(message ?? ''))}`,
    `habit_context: ${buildHabitList(habits)}`,
  ].join('\n\n');
}

function buildQuestPrompt({ snapshot }) {
  return [
    'Task: draft one AI quest for this user.',
    'Important rules:',
    '- this is only a draft for backend validation later',
    '- do not mention database writes or saving',
    '- keep the quest grounded in the provided real user snapshot',
    '- do not fabricate unsupported app mechanics',
    '- prefer practical quests that reinforce good habits or help recover weak areas',
    '- keep rewards reasonable; backend will clamp later',
    'Return strict JSON with this exact shape:',
    JSON.stringify({
      title: 'string',
      description: 'string',
      difficulty: 'easy',
      target: 3,
      duration_days: 7,
      exp_reward: 80,
      gold_reward: 20,
      steps: [
        {
          step_order: 1,
          title: 'string',
          action_type: 'habit_checkin',
        },
      ],
    }, null, 2),
    `user_snapshot: ${JSON.stringify(snapshot, null, 2)}`,
  ].join('\n\n');
}

function buildInsightPrompt({ analyticsPayload, days }) {
  return [
    'Task: explain the analytics payload for the user in Vietnamese.',
    'Important rules:',
    '- only use numbers and trends that exist in the payload',
    '- do not fabricate statistics',
    '- if a metric is missing, describe it qualitatively without inventing numbers',
    '- keep next actions practical and habit-focused',
    'Return strict JSON with this exact shape:',
    JSON.stringify({
      insight_summary: 'string',
      strengths: ['string'],
      risks: ['string'],
      next_actions: ['string'],
    }, null, 2),
    `requested_days: ${Number(days)}`,
    `analytics_payload: ${JSON.stringify(analyticsPayload, null, 2)}`,
  ].join('\n\n');
}

function buildAnalyticsReportPrompt({ analyticsPayload, period }) {
  return [
    'Task: write a concise Vietnamese analytics report for a habit tracker PDF.',
    'Important rules:',
    '- only use facts and numbers that exist in the supplied analytics payload',
    '- do not fabricate statistics, dates, habit names, streaks, EXP, HP, or rates',
    '- write practical recommendations tied to the supplied data',
    '- keep each sentence short and suitable for a PDF report',
    'Return strict JSON with this exact shape:',
    JSON.stringify({
      title: 'string',
      subtitle: 'string',
      executive_summary: 'string',
      key_metrics: [
        {
          label: 'string',
          value: 'string',
          note: 'string',
        },
      ],
      strengths: ['string'],
      risks: ['string'],
      recommendations: ['string'],
      next_week_plan: ['string'],
      closing_note: 'string',
    }, null, 2),
    `period: ${String(period ?? 'week')}`,
    `analytics_payload: ${JSON.stringify(analyticsPayload, null, 2)}`,
  ].join('\n\n');
}

module.exports = {
  CHAT_SYSTEM_PROMPT,
  HABIT_CHECKIN_SYSTEM_PROMPT,
  buildSupportChatPrompt,
  buildHabitCheckinPrompt,
  buildQuestPrompt,
  buildInsightPrompt,
  buildAnalyticsReportPrompt,
};
