function asNonEmptyString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNullableString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNullableNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function asPositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numericValue = Number.parseInt(value, 10);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function normalizeChatActions(actions, availableHabitTitles = []) {
  const titleLookup = new Map(
    availableHabitTitles.map((title) => [String(title).trim().toLowerCase(), title]),
  );
  const allowedActions = new Set(['complete', 'partial', 'failed', 'avoid_success']);

  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action) => {
      const rawTitle = asNonEmptyString(action?.habit_title);
      const normalizedTitle = titleLookup.get(rawTitle.toLowerCase()) ?? null;
      const actionType = asNonEmptyString(action?.action).toLowerCase();

      if (!normalizedTitle || !allowedActions.has(actionType)) {
        return null;
      }

      return {
        type: 'habit_checkin',
        habit_title: normalizedTitle,
        action: actionType,
        value: asNullableNumber(action?.value),
        unit: asNullableString(action?.unit),
      };
    })
    .filter(Boolean);
}

function normalizeChatResponse(payload, options = {}) {
  const defaultMode = options.defaultMode === 'habit_checkin' ? 'habit_checkin' : 'support_chat';
  const resolvedMode =
    payload?.mode === 'habit_checkin' || payload?.mode === 'support_chat'
      ? payload.mode
      : defaultMode;
  const normalizedActions =
    resolvedMode === 'habit_checkin'
      ? normalizeChatActions(payload?.actions, options.availableHabitTitles ?? [])
      : [];
  const clarificationNeeded = asBoolean(payload?.clarification_needed, false);
  const clarificationQuestion = clarificationNeeded
    ? asNullableString(payload?.clarification_question) ??
      'Bạn muốn check-in thói quen nào vậy?'
    : null;

  if (resolvedMode === 'support_chat') {
    return {
      mode: 'support_chat',
      intent: asNullableString(payload?.intent),
      reply:
        asNonEmptyString(payload?.reply) ||
        'Mình sẵn sàng hỗ trợ bạn về cách dùng app và xây dựng thói quen.',
      actions: [],
      clarification_needed: false,
      clarification_question: null,
    };
  }

  return {
    mode: 'habit_checkin',
    intent: asNullableString(payload?.intent) ?? 'check_in',
    reply:
      asNonEmptyString(payload?.reply) ||
      (clarificationNeeded
        ? 'Mình cần thêm một chút thông tin để check-in chính xác.'
        : 'Mình đã ghi nhận nội dung check-in để backend xác thực tiếp.'),
    actions: clarificationNeeded ? [] : normalizedActions,
    clarification_needed: clarificationNeeded || normalizedActions.length === 0,
    clarification_question:
      clarificationNeeded || normalizedActions.length === 0
        ? clarificationQuestion ?? 'Bạn đang muốn check-in thói quen nào vậy?'
        : null,
  };
}

function normalizeQuestDraft(payload) {
  const allowedDifficulties = new Set(['easy', 'normal', 'hard', 'epic']);
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];

  return {
    title: asNonEmptyString(payload?.title, 'Nhiệm vụ đồng hành mới'),
    description: asNonEmptyString(
      payload?.description,
      'Một nhiệm vụ ngắn để giúp bạn giữ nhịp thói quen trong vài ngày tới.',
    ),
    difficulty: allowedDifficulties.has(String(payload?.difficulty).trim().toLowerCase())
      ? String(payload.difficulty).trim().toLowerCase()
      : 'normal',
    target: asPositiveInteger(payload?.target, 1, { min: 1, max: 999 }),
    duration_days: asPositiveInteger(payload?.duration_days, 7, { min: 1, max: 30 }),
    exp_reward: asPositiveInteger(payload?.exp_reward, 50, { min: 0, max: 10000 }),
    gold_reward: asPositiveInteger(payload?.gold_reward, 0, { min: 0, max: 10000 }),
    steps: steps
      .map((step, index) => ({
        step_order: asPositiveInteger(step?.step_order, index + 1, { min: 1, max: 99 }),
        title: asNonEmptyString(step?.title, `Bước ${index + 1}`),
        action_type: asNonEmptyString(step?.action_type, 'habit_checkin'),
      }))
      .filter((step) => step.title),
  };
}

function normalizeInsightResponse(payload) {
  const normalizeList = (value, fallback) => {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const items = value
      .map((item) => asNonEmptyString(item))
      .filter(Boolean)
      .slice(0, 5);

    return items.length > 0 ? items : fallback;
  };

  return {
    insight_summary: asNonEmptyString(
      payload?.insight_summary,
      'Mình chưa rút ra đủ insight rõ ràng từ dữ liệu hiện có.',
    ),
    strengths: normalizeList(payload?.strengths, ['Bạn vẫn đang duy trì dữ liệu để theo dõi tiến độ.']),
    risks: normalizeList(payload?.risks, ['Chưa có đủ tín hiệu mạnh để kết luận rủi ro cụ thể.']),
    next_actions: normalizeList(payload?.next_actions, ['Tiếp tục check-in đều để insight sau chính xác hơn.']),
  };
}

module.exports = {
  normalizeChatResponse,
  normalizeInsightResponse,
  normalizeQuestDraft,
};
