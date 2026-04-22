const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const {
  ALL_DAY_NUMBERS,
  toFrequencyDayKeys,
  toFrequencyDayNumbers,
} = require("../utils/frequencyDays");
const {
  addDays,
  applyCharacterProgress,
  buildHabitProgressMap,
  calculateHabitStreak,
  calculateGlobalStreak,
  getDailyStreakGold,
  getGoldPerTask,
  getHabitStartDate,
  isHabitScheduledOnDate,
  toDateKey,
} = require("../utils/habitProgress");
const {
  getHabitType,
  isAllowedStatusForHabit,
  isNegativeHabit,
  isPositiveHabit,
  isSuccessStatus,
  isSuccessfulLogForHabit,
} = require("../utils/habitStatus");

const router = express.Router();

const DEFAULT_REMINDER_BY_TIME = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "20:00",
};
const HABIT_LOG_SELECT_FIELDS =
  "log_id, habit_id, log_date, status, hp_change, exp_change, streak_at_log, logged_at";
const HABIT_NOT_FOUND_MESSAGE = "Habit not found.";
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedCategoryMap = null;
let cachedCategoryMapExpiresAt = 0;

function normalizeFrequencyDays(frequencyType, frequencyDays) {
  if (frequencyType === "daily") {
    return ALL_DAY_NUMBERS;
  }

  if (frequencyType === "weekly") {
    return toFrequencyDayNumbers(frequencyDays);
  }

  return [];
}

function getDefaultReminder(preferredTime) {
  return DEFAULT_REMINDER_BY_TIME[preferredTime] ?? DEFAULT_REMINDER_BY_TIME.morning;
}

function getDefaultStartDate(createdAt) {
  return toDateKey(createdAt ?? new Date());
}

function buildDefaultHabitMetadata(createdAt, preferredTime = "morning") {
  return {
    categoryLabel: null,
    preferredTime,
    startDate: getDefaultStartDate(createdAt),
    reminders: [getDefaultReminder(preferredTime)],
  };
}

function parseFormDescription(description, createdAt) {
  const categoryMatch = description?.match(/Category:\s(.+?)\./i);
  const preferredTimeMatch = description?.match(/Preferred time:\s(.+?)\./i);
  const startDateMatch = description?.match(/Start date:\s(\d{4}-\d{2}-\d{2})\./i);
  const reminderMatch = description?.match(/Reminders:\s(.+?)\./i);

  const preferredTime = preferredTimeMatch?.[1] ?? "morning";
  const reminders =
    reminderMatch?.[1] && reminderMatch[1] !== "No reminders"
      ? reminderMatch[1].split(",").map((item) => item.trim()).filter(Boolean)
      : [getDefaultReminder(preferredTime)];

  return {
    categoryLabel: categoryMatch?.[1] ?? null,
    preferredTime,
    startDate: startDateMatch?.[1] ?? getDefaultStartDate(createdAt),
    reminders,
  };
}

function parseOnboardingDescription(description, createdAt) {
  const areaMatch = description?.match(/Area:\s(.+?)\.\sScheduled:/i);
  const scheduleMatch = description?.match(/Scheduled:\s(\w+)\sat\s(\d{2}:\d{2})/i);
  const preferredTime = scheduleMatch?.[1] ?? "morning";
  const reminderTime = scheduleMatch?.[2] ?? getDefaultReminder(preferredTime);

  return {
    categoryLabel: areaMatch?.[1] ?? null,
    preferredTime,
    startDate: getDefaultStartDate(createdAt),
    reminders: [reminderTime],
  };
}

function extractHabitMetadata(description, createdAt) {
  if (typeof description !== "string") {
    return buildDefaultHabitMetadata(createdAt);
  }

  if (description.startsWith("Created from mobile habit form.")) {
    return parseFormDescription(description, createdAt);
  }

  if (description.startsWith("Created during onboarding.")) {
    return parseOnboardingDescription(description, createdAt);
  }

  return buildDefaultHabitMetadata(createdAt);
}

async function loadCategoryMap() {
  if (cachedCategoryMap && cachedCategoryMapExpiresAt > Date.now()) {
    return cachedCategoryMap;
  }

  const { data, error } = await supabase
    .from("habit_categories")
    .select("category_id, name");

  if (error) {
    throw error;
  }

  cachedCategoryMap = new Map(
    (data ?? []).map((category) => [category.category_id, category.name]),
  );
  cachedCategoryMapExpiresAt = Date.now() + CATEGORY_CACHE_TTL_MS;

  return cachedCategoryMap;
}

async function resolveCategoryId(categoryLabel) {
  if (!categoryLabel) {
    return null;
  }

  const { data, error } = await supabase
    .from("habit_categories")
    .select("category_id")
    .ilike("name", categoryLabel)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.category_id ?? null;
}

function buildDescription({
  categoryLabel,
  preferredTime,
  startDate,
  reminders,
  frequencyType,
}) {
  const reminderLabel =
    reminders?.length > 0 ? reminders.join(", ") : "No reminders";

  return [
    "Created from mobile habit form.",
    `Category: ${categoryLabel ?? "General"}.`,
    `Preferred time: ${preferredTime ?? "morning"}.`,
    `Start date: ${startDate ?? getDefaultStartDate()}.`,
    `Frequency: ${frequencyType ?? "daily"}.`,
    `Reminders: ${reminderLabel}.`,
  ].join(" ");
}

function normalizePayload(body) {
  const trimmedTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const normalizedFrequencyType =
    body?.frequencyType === "weekly" || body?.frequencyType === "monthly"
      ? body.frequencyType
      : "daily";
  const normalizedDays = normalizeFrequencyDays(
    normalizedFrequencyType,
    body?.frequencyDays,
  );
  const normalizedTargetValue = Number(body?.targetValue);
  const preferredTime =
    body?.preferredTime === "afternoon" || body?.preferredTime === "evening"
      ? body.preferredTime
      : "morning";
  const reminders =
    Array.isArray(body?.reminders) && body.reminders.length > 0
      ? body.reminders
      : [getDefaultReminder(preferredTime)];

  return {
    trimmedTitle,
    normalizedFrequencyType,
    normalizedDays,
    normalizedTargetValue,
    habitType: getHabitType({ habitType: body?.habitType }),
    targetUnit: typeof body?.targetUnit === "string" ? body.targetUnit : "times",
    preferredTime,
    categoryLabel: typeof body?.categoryLabel === "string" ? body.categoryLabel : null,
    startDate:
      typeof body?.startDate === "string" && body.startDate
        ? body.startDate
        : getDefaultStartDate(),
    reminders,
  };
}

function validatePayload(payload) {
  if (!payload.trimmedTitle) {
    return "Habit title is required.";
  }

  if (
    payload.normalizedFrequencyType === "weekly" &&
    payload.normalizedDays.length === 0
  ) {
    return "Please choose at least one day for a weekly habit.";
  }

  if (
    !Number.isFinite(payload.normalizedTargetValue) ||
    payload.normalizedTargetValue <= 0
  ) {
    return "Target value must be greater than zero.";
  }

  return null;
}

function buildHabitMutationPayload(payload, categoryId, options = {}) {
  const {
    userId = null,
    includeInsertDefaults = false,
    includeUpdatedAt = false,
  } = options;
  const habitPayload = {
    category_id: categoryId,
    title: payload.trimmedTitle,
    description: buildDescription(payload),
    habit_type: payload.habitType,
    target_value: payload.normalizedTargetValue,
    target_unit: payload.targetUnit,
    frequency_type: payload.normalizedFrequencyType,
    frequency_days: payload.normalizedDays,
  };

  if (includeInsertDefaults) {
    Object.assign(habitPayload, {
      user_id: userId,
      tracking_method: "boolean",
      hp_reward: 10,
      exp_reward: 20,
      hp_penalty: 15,
      streak_bonus_exp: 5,
      is_active: true,
    });
  }

  if (includeUpdatedAt) {
    habitPayload.updated_at = new Date().toISOString();
  }

  return habitPayload;
}

function serializeHabit(habit, categoryMap, progress = {}) {
  const metadata = extractHabitMetadata(habit.description, habit.created_at);

  return {
    id: habit.habit_id,
    title: habit.title,
    habitType: getHabitType(habit),
    targetValue: Number(habit.target_value ?? 1),
    targetUnit: habit.target_unit ?? "times",
    frequencyType: habit.frequency_type ?? "daily",
    frequencyDays: toFrequencyDayKeys(habit.frequency_days ?? []),
    categoryLabel:
      categoryMap.get(habit.category_id) ?? metadata.categoryLabel ?? null,
    preferredTime: metadata.preferredTime,
    startDate: metadata.startDate,
    reminders: metadata.reminders,
    isActive: habit.is_active ?? true,
    createdAt: habit.created_at,
    updatedAt: habit.updated_at,
    completedToday: progress.completedToday ?? false,
    loggedToday: progress.loggedToday ?? false,
    todayStatus: progress.todayStatus ?? null,
    currentStreak: progress.currentStreak ?? 0,
    bestStreak: progress.bestStreak ?? 0,
    lastCompletedAt: progress.lastCompletedAt ?? null,
    isScheduledToday: progress.isScheduledToday ?? false,
    expReward: Number(habit.exp_reward ?? 0),
    streakBonusExp: Number(habit.streak_bonus_exp ?? 0),
  };
}

async function fetchHabitById(habitId, userId) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("habit_id", habitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchHabitLogs(userId, habitId = null) {
  let query = supabase
    .from("habit_logs")
    .select(HABIT_LOG_SELECT_FIELDS)
    .eq("user_id", userId);

  if (habitId) {
    query = query.eq("habit_id", habitId);
  }

  const { data, error } = await query.order("log_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchTodayHabitLog(userId, habitId, dateKey) {
  const { data, error } = await supabase
    .from("habit_logs")
    .select(HABIT_LOG_SELECT_FIELDS)
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("log_date", dateKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchLogsForDate(userId, dateKey) {
  const { data, error } = await supabase
    .from("habit_logs")
    .select(HABIT_LOG_SELECT_FIELDS)
    .eq("user_id", userId)
    .eq("log_date", dateKey)
    .order("logged_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchUserHabits(userId) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchHabitCompletionContext(userId, habitId, dateKey) {
  const [categoryMap, habit, character, existingLogs, todayLog] = await Promise.all([
    loadCategoryMap(),
    fetchHabitById(habitId, userId),
    fetchCharacter(userId),
    fetchHabitLogs(userId),
    fetchTodayHabitLog(userId, habitId, dateKey),
  ]);

  return {
    categoryMap,
    habit,
    character,
    existingLogs,
    todayLog,
  };
}

function getSuccessfulDateKeys(habit, logs = [], excludedLogId = null) {
  return logs
    .filter(
      (log) =>
        log.log_id !== excludedLogId &&
        isSuccessfulLogForHabit(habit, log),
    )
    .map((log) => toDateKey(log.log_date));
}

function buildHabitLogEffects(habit, status, nextStreak) {
  if (isPositiveHabit(habit)) {
    if (status === "completed") {
      return {
        expChange:
          Number(habit.exp_reward ?? 0) +
          (nextStreak.currentStreak > 1
            ? Number(habit.streak_bonus_exp ?? 0)
            : 0),
        hpChange: Number(habit.hp_reward ?? 0),
        streakAtLog: nextStreak.currentStreak,
      };
    }

    if (status === "punished") {
      return {
        expChange: 0,
        hpChange: -Number(habit.hp_penalty ?? 0),
        streakAtLog: 0,
      };
    }

    return {
      expChange: 0,
      hpChange: 0,
      streakAtLog: 0,
    };
  }

  if (status === "avoided") {
    return {
      expChange: Number(habit.exp_reward ?? 0),
      hpChange: 0,
      streakAtLog: nextStreak.currentStreak,
    };
  }

  return {
    expChange: 0,
    hpChange: -Number(habit.hp_penalty ?? 0),
    streakAtLog: 0,
  };
}

function sumLogReward(logs = [], key) {
  return logs.reduce((total, log) => total + Number(log?.[key] ?? 0), 0);
}

function getSuccessfulDateKeysForUser(habitsById, logs = []) {
  return logs
    .filter((log) => {
      const habit = habitsById.get(log?.habit_id);
      return habit && isSuccessfulLogForHabit(habit, log);
    })
    .map((log) => toDateKey(log.log_date));
}

function getLogsForDate(logs = [], dateKey) {
  return logs
    .filter((log) => toDateKey(log.log_date) === dateKey)
    .sort((leftLog, rightLog) => {
      const leftTime = Date.parse(leftLog?.logged_at ?? 0);
      const rightTime = Date.parse(rightLog?.logged_at ?? 0);

      return leftTime - rightTime;
    });
}

function computeTodayGoldTotal({
  character,
  todayLogs,
  allLogs,
  userHabits,
  dateKey,
}) {
  const normalizedTodayLogs = getLogsForDate(todayLogs, dateKey);
  const habitsById = new Map(userHabits.map((habit) => [habit.habit_id, habit]));
  const successfulDateKeys = getSuccessfulDateKeysForUser(habitsById, allLogs);
  const currentGlobalStreak = calculateGlobalStreak(successfulDateKeys, dateKey).streak;
  const streakDailyGold = getDailyStreakGold(currentGlobalStreak);
  const scheduledHabitIds = new Set(
    userHabits
      .filter((habit) => habit.is_active !== false)
      .filter((habit) => isHabitScheduledOnDate(habit, dateKey))
      .map((habit) => habit.habit_id),
  );
  const startOfDayCharacter = applyCharacterProgress(
    character,
    -sumLogReward(normalizedTodayLogs, "exp_change"),
    -sumLogReward(normalizedTodayLogs, "hp_change"),
    0,
  );

  let nextCharacter = { ...startOfDayCharacter };
  let didAwardStreakGold = false;
  let didAwardDailyCompletionGold = false;
  let totalGold = 0;
  const successfulTodayHabitIds = new Set();

  for (const log of normalizedTodayLogs) {
    const habit = habitsById.get(log.habit_id);
    const logExpChange = Number(log.exp_change ?? 0);
    const logHpChange = Number(log.hp_change ?? 0);

    if (!habit || !isSuccessfulLogForHabit(habit, log)) {
      nextCharacter = applyCharacterProgress(
        nextCharacter,
        logExpChange,
        logHpChange,
        0,
      );
      continue;
    }

    const taskGold = getGoldPerTask(nextCharacter.level);
    const postExpCharacter = applyCharacterProgress(
      nextCharacter,
      logExpChange,
      logHpChange,
      0,
    );
    const levelUpGold = Math.max(0, postExpCharacter.level - nextCharacter.level) * 10;
    const streakGold = didAwardStreakGold ? 0 : streakDailyGold;

    successfulTodayHabitIds.add(log.habit_id);

    const completedAllTodayHabits =
      !didAwardDailyCompletionGold &&
      scheduledHabitIds.size > 0 &&
      [...scheduledHabitIds].every((habitId) => successfulTodayHabitIds.has(habitId));
    const dailyCompletionGold = completedAllTodayHabits ? 10 : 0;
    const goldChange = taskGold + levelUpGold + streakGold + dailyCompletionGold;

    totalGold += goldChange;
    nextCharacter = applyCharacterProgress(
      nextCharacter,
      logExpChange,
      logHpChange,
      goldChange,
    );
    didAwardStreakGold = true;

    if (completedAllTodayHabits) {
      didAwardDailyCompletionGold = true;
    }
  }

  return totalGold;
}

function buildNextLogs(existingLogs = [], previousLog = null, nextLog = null) {
  const filteredLogs = previousLog?.log_id
    ? existingLogs.filter((log) => log.log_id !== previousLog.log_id)
    : [...existingLogs];

  if (!nextLog) {
    return filteredLogs;
  }

  return [...filteredLogs, nextLog];
}

async function rebalanceTodayGoldRewards(userId, dateKey) {
  const [character, todayLogs, allLogs, userHabits] = await Promise.all([
    fetchCharacter(userId),
    fetchLogsForDate(userId, dateKey),
    fetchHabitLogs(userId),
    fetchUserHabits(userId),
  ]);

  const existingTodayGold = sumLogReward(todayLogs, "gold_change");
  const startOfDayCharacter = applyCharacterProgress(
    character,
    -sumLogReward(todayLogs, "exp_change"),
    -sumLogReward(todayLogs, "hp_change"),
    -existingTodayGold,
  );
  const habitsById = new Map(userHabits.map((habit) => [habit.habit_id, habit]));
  const successfulDateKeys = getSuccessfulDateKeysForUser(habitsById, allLogs);
  const currentGlobalStreak = calculateGlobalStreak(successfulDateKeys, dateKey).streak;
  const streakDailyGold = getDailyStreakGold(currentGlobalStreak);
  const scheduledHabitIds = new Set(
    userHabits
      .filter((habit) => habit.is_active !== false)
      .filter((habit) => isHabitScheduledOnDate(habit, dateKey))
      .map((habit) => habit.habit_id),
  );

  let nextCharacter = { ...startOfDayCharacter };
  let didAwardStreakGold = false;
  let didAwardDailyCompletionGold = false;
  const successfulTodayHabitIds = new Set();
  const nextGoldByLogId = new Map();

  for (const log of todayLogs) {
    const habit = habitsById.get(log.habit_id);
    const logExpChange = Number(log.exp_change ?? 0);
    const logHpChange = Number(log.hp_change ?? 0);

    if (!habit || !isSuccessfulLogForHabit(habit, log)) {
      nextGoldByLogId.set(log.log_id, 0);
      nextCharacter = applyCharacterProgress(
        nextCharacter,
        logExpChange,
        logHpChange,
        0,
      );
      continue;
    }

    const taskGold = getGoldPerTask(nextCharacter.level);
    const postExpCharacter = applyCharacterProgress(
      nextCharacter,
      logExpChange,
      logHpChange,
      0,
    );
    const levelUpGold = Math.max(0, postExpCharacter.level - nextCharacter.level) * 10;
    const streakGold = didAwardStreakGold ? 0 : streakDailyGold;

    successfulTodayHabitIds.add(log.habit_id);

    const completedAllTodayHabits =
      !didAwardDailyCompletionGold &&
      scheduledHabitIds.size > 0 &&
      [...scheduledHabitIds].every((habitId) => successfulTodayHabitIds.has(habitId));
    const dailyCompletionGold = completedAllTodayHabits ? 10 : 0;
    const goldChange = taskGold + levelUpGold + streakGold + dailyCompletionGold;

    nextGoldByLogId.set(log.log_id, goldChange);
    nextCharacter = applyCharacterProgress(
      nextCharacter,
      logExpChange,
      logHpChange,
      goldChange,
    );
    didAwardStreakGold = true;

    if (completedAllTodayHabits) {
      didAwardDailyCompletionGold = true;
    }
  }

  await Promise.all(
    todayLogs.map((log) => {
      const nextGold = nextGoldByLogId.get(log.log_id) ?? 0;

      if (Number(log.gold_change ?? 0) === nextGold) {
        return Promise.resolve();
      }

      return supabase
        .from("habit_logs")
        .update({ gold_change: nextGold })
        .eq("log_id", log.log_id);
    }),
  );

  if ((character.gold_coins ?? 0) !== (nextCharacter.gold_coins ?? 0)) {
    await updateCharacterProgress(userId, character.character_id, {
      gold_coins: nextCharacter.gold_coins ?? 0,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    goldDelta: (nextCharacter.gold_coins ?? 0) - (character.gold_coins ?? 0),
  };
}

async function persistHabitStatus({
  userId,
  habit,
  character,
  existingLogs,
  todayLog,
  dateKey,
  status,
  manualOnly = true,
}) {
  if (!isHabitScheduledOnDate(habit, dateKey)) {
    const error = new Error("This habit is not scheduled for today.");
    error.statusCode = 400;
    throw error;
  }

  if (!isAllowedStatusForHabit(habit, status, { manualOnly })) {
    const error = new Error("This status is not allowed for this habit.");
    error.statusCode = 400;
    throw error;
  }

  const successfulDateKeys = getSuccessfulDateKeys(
    habit,
    existingLogs,
    todayLog?.log_id ?? null,
  );
  const nextSuccessfulDateKeys = isSuccessStatus(status)
    ? [...successfulDateKeys, dateKey]
    : successfulDateKeys;
  const nextStreak = calculateHabitStreak(
    habit,
    nextSuccessfulDateKeys,
    dateKey,
  );
  const { expChange, hpChange, streakAtLog } = buildHabitLogEffects(
    habit,
    status,
    nextStreak,
  );
  const characterDelta = {
    exp: expChange - Number(todayLog?.exp_change ?? 0),
    hp: hpChange - Number(todayLog?.hp_change ?? 0),
  };
  const payload = {
    habit_id: habit.habit_id,
    user_id: userId,
    log_date: dateKey,
    status,
    value_recorded: Number(habit.target_value ?? 1),
    hp_change: hpChange,
    exp_change: expChange,
    streak_at_log: streakAtLog,
    source: "manual",
  };
  const userHabits = await fetchUserHabits(userId);

  const previousTodayLogs = getLogsForDate(existingLogs, dateKey);
  const previousTotalGold = computeTodayGoldTotal({
    character,
    todayLogs: previousTodayLogs,
    allLogs: existingLogs,
    userHabits,
    dateKey,
  });

  let savedLog = null;

  if (todayLog?.log_id) {
    const { data, error } = await supabase
      .from("habit_logs")
      .update(payload)
      .eq("log_id", todayLog.log_id)
      .select("log_id, logged_at")
      .single();

    if (error) {
      throw error;
    }

    savedLog = data;
  } else {
    const { data, error } = await supabase
      .from("habit_logs")
      .insert(payload)
      .select("log_id, logged_at")
      .single();

    if (error) {
      throw error;
    }

    savedLog = data;
  }

  const nextLog = {
    ...(todayLog ?? {}),
    log_id: savedLog?.log_id ?? todayLog?.log_id ?? null,
    habit_id: habit.habit_id,
    log_date: dateKey,
    status,
    hp_change: hpChange,
    exp_change: expChange,
    streak_at_log: streakAtLog,
    logged_at: savedLog?.logged_at ?? todayLog?.logged_at ?? new Date().toISOString(),
  };
  const nextLogs = buildNextLogs(existingLogs, todayLog, nextLog);
  const nextCharacter = applyCharacterProgress(
    character,
    characterDelta.exp,
    characterDelta.hp,
    0,
  );
  const nextTodayLogs = getLogsForDate(nextLogs, dateKey);
  const nextTotalGold = computeTodayGoldTotal({
    character: nextCharacter,
    todayLogs: nextTodayLogs,
    allLogs: nextLogs,
    userHabits,
    dateKey,
  });
  const goldDelta = nextTotalGold - previousTotalGold;

  await Promise.all([
    syncHabitStreakRecord(userId, habit.habit_id, nextStreak),
    updateCharacterProgress(
      userId,
      character.character_id,
      applyCharacterProgress(
        character,
        characterDelta.exp,
        characterDelta.hp,
        goldDelta,
      ),
    ),
  ]);

  return {
    logId: savedLog?.log_id ?? todayLog?.log_id ?? null,
    nextStreak,
    rewards: {
      exp: characterDelta.exp,
      hp: characterDelta.hp,
      gold: goldDelta,
    },
    progress: {
      completedToday: isSuccessStatus(status),
      loggedToday: true,
      todayStatus: status,
      currentStreak: nextStreak.currentStreak,
      bestStreak: nextStreak.bestStreak,
      lastCompletedAt: nextStreak.lastCompletedAt,
      isScheduledToday: true,
    },
  };
}

async function clearTodayHabitStatus({
  userId,
  habit,
  character,
  existingLogs,
  todayLog,
  dateKey,
  preserveExpOnClear = false,
}) {
  if (!todayLog?.log_id) {
    return {
      rewards: { exp: 0, hp: 0, gold: 0 },
      progress: buildHabitProgressMap([habit], existingLogs, dateKey).get(habit.habit_id),
    };
  }

  const previousTodayLogs = getLogsForDate(existingLogs, dateKey);
  const userHabits = await fetchUserHabits(userId);
  const previousTotalGold = computeTodayGoldTotal({
    character,
    todayLogs: previousTodayLogs,
    allLogs: existingLogs,
    userHabits,
    dateKey,
  });

  const shouldPreserveExp =
    preserveExpOnClear &&
    isPositiveHabit(habit) &&
    Number(todayLog.exp_change ?? 0) > 0;

  if (shouldPreserveExp) {
    const { error } = await supabase
      .from("habit_logs")
      .update({
        status: "missed",
        hp_change: 0,
        streak_at_log: 0,
      })
      .eq("log_id", todayLog.log_id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("log_id", todayLog.log_id);

    if (error) {
      throw error;
    }
  }

  const remainingSuccessfulDateKeys = getSuccessfulDateKeys(
    habit,
    existingLogs,
    todayLog.log_id,
  );
  const nextStreak = calculateHabitStreak(
    habit,
    remainingSuccessfulDateKeys,
    dateKey,
  );
  const nextLog = shouldPreserveExp
    ? {
        ...todayLog,
        status: "missed",
        hp_change: 0,
        streak_at_log: 0,
      }
    : null;
  const nextLogs = buildNextLogs(existingLogs, todayLog, nextLog);
  const nextCharacter = applyCharacterProgress(
    character,
    shouldPreserveExp ? 0 : -Number(todayLog.exp_change ?? 0),
    -Number(todayLog.hp_change ?? 0),
    0,
  );
  const nextTodayLogs = getLogsForDate(nextLogs, dateKey);
  const nextTotalGold = computeTodayGoldTotal({
    character: nextCharacter,
    todayLogs: nextTodayLogs,
    allLogs: nextLogs,
    userHabits,
    dateKey,
  });
  const goldDelta = nextTotalGold - previousTotalGold;

  await Promise.all([
    syncHabitStreakRecord(userId, habit.habit_id, nextStreak),
    updateCharacterProgress(
      userId,
      character.character_id,
      applyCharacterProgress(
        character,
        shouldPreserveExp ? 0 : -Number(todayLog.exp_change ?? 0),
        -Number(todayLog.hp_change ?? 0),
        goldDelta,
      ),
    ),
  ]);

  return {
    rewards: {
      exp: shouldPreserveExp ? 0 : -Number(todayLog.exp_change ?? 0),
      hp: -Number(todayLog.hp_change ?? 0),
      gold: goldDelta,
    },
    progress: {
      completedToday: false,
      loggedToday: false,
      todayStatus: isNegativeHabit(habit) ? "unverified" : null,
      currentStreak: nextStreak.currentStreak,
      bestStreak: nextStreak.bestStreak,
      lastCompletedAt: nextStreak.lastCompletedAt,
      isScheduledToday: isHabitScheduledOnDate(habit, dateKey),
    },
  };
}

function buildProgressResponse(habit, categoryMap, progress, rewards = { exp: 0, hp: 0, gold: 0 }) {
  return {
    habit: serializeHabit(habit, categoryMap, progress),
    rewards,
  };
}

function buildCurrentProgressResponse(
  habit,
  categoryMap,
  existingLogs,
  todayDateKey,
  rewards = { exp: 0, hp: 0, gold: 0 },
) {
  const progressMap = buildHabitProgressMap([habit], existingLogs, todayDateKey);

  return buildProgressResponse(
    habit,
    categoryMap,
    progressMap.get(habit.habit_id),
    rewards,
  );
}

async function fetchCharacter(userId) {
  const { data, error } = await supabase
    .from("characters")
    .select("character_id, level, current_hp, max_hp, current_exp, exp_to_next_level, gold_coins")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function syncHabitStreakRecord(userId, habitId, streak) {
  const { data: existingRecord, error: existingRecordError } = await supabase
    .from("habit_streaks")
    .select("streak_id")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .limit(1)
    .maybeSingle();

  if (existingRecordError) {
    throw existingRecordError;
  }

  const payload = {
    user_id: userId,
    habit_id: habitId,
    current_streak: streak.currentStreak,
    best_streak: streak.bestStreak,
    last_completed_at: streak.lastCompletedAt,
    updated_at: new Date().toISOString(),
  };

  if (existingRecord?.streak_id) {
    const { error } = await supabase
      .from("habit_streaks")
      .update(payload)
      .eq("streak_id", existingRecord.streak_id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("habit_streaks").insert(payload);

  if (error) {
    throw error;
  }
}

async function updateCharacterProgress(userId, characterId, payload) {
  const { error } = await supabase
    .from("characters")
    .update(payload)
    .eq("user_id", userId)
    .eq("character_id", characterId);

  if (error) {
    throw error;
  }
}

async function applyOverduePunishmentsForUser(userId, throughDateKey = addDays(toDateKey(), -1)) {
  if (throughDateKey < "0001-01-01") {
    return { appliedCount: 0, totalHpPenalty: 0 };
  }

  const [{ data: habits, error: habitsError }, character, logs] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("habit_type", "positive")
      .eq("frequency_type", "daily")
      .eq("is_active", true),
    fetchCharacter(userId),
    fetchHabitLogs(userId),
  ]);

  if (habitsError) {
    throw habitsError;
  }

  const existingLogKeys = new Set(
    logs.map((log) => `${log.habit_id}:${toDateKey(log.log_date)}`),
  );
  const pendingLogs = [];
  let totalHpPenalty = 0;

  for (const habit of habits ?? []) {
    let cursor = getHabitStartDate(habit);

    while (cursor <= throughDateKey) {
      const logKey = `${habit.habit_id}:${cursor}`;

      if (!existingLogKeys.has(logKey) && isHabitScheduledOnDate(habit, cursor)) {
        const hpPenalty = Number(habit.hp_penalty ?? 0);

        pendingLogs.push({
          habit_id: habit.habit_id,
          user_id: userId,
          log_date: cursor,
          status: "punished",
          value_recorded: Number(habit.target_value ?? 1),
          hp_change: -hpPenalty,
          exp_change: 0,
          streak_at_log: 0,
        });
        totalHpPenalty += hpPenalty;
        existingLogKeys.add(logKey);
      }

      cursor = addDays(cursor, 1);
    }
  }

  if (!pendingLogs.length) {
    return { appliedCount: 0, totalHpPenalty: 0 };
  }

  const { error: insertError } = await supabase
    .from("habit_logs")
    .insert(pendingLogs);

  if (insertError) {
    throw insertError;
  }

  if (totalHpPenalty > 0) {
    await updateCharacterProgress(
      userId,
      character.character_id,
      applyCharacterProgress(character, 0, -totalHpPenalty),
    );
  }

  const allLogs = [...logs, ...pendingLogs];

  await Promise.all(
    (habits ?? []).map((habit) =>
      syncHabitStreakRecord(
        userId,
        habit.habit_id,
        calculateHabitStreak(
          habit,
          getSuccessfulDateKeys(habit, allLogs),
          toDateKey(),
        ),
      ),
    ),
  );

  return {
    appliedCount: pendingLogs.length,
    totalHpPenalty,
  };
}

router.get("/", requireUser, async (req, res) => {
  try {
    const [categoryMap, habitsResult, logs] = await Promise.all([
      loadCategoryMap(),
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", req.userId)
        .order("created_at", { ascending: false }),
      fetchHabitLogs(req.userId),
    ]);

    if (habitsResult.error) {
      console.error("List habits error:", habitsResult.error);
      return res.status(400).json({ message: habitsResult.error.message });
    }

    const progressMap = buildHabitProgressMap(habitsResult.data ?? [], logs);

    return res.json({
      habits: (habitsResult.data ?? []).map((habit) =>
        serializeHabit(habit, categoryMap, progressMap.get(habit.habit_id)),
      ),
    });
  } catch (error) {
    console.error("List habits error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/:habitId", requireUser, async (req, res) => {
  try {
    const [categoryMap, habit, logs] = await Promise.all([
      loadCategoryMap(),
      fetchHabitById(req.params.habitId, req.userId),
      fetchHabitLogs(req.userId, req.params.habitId),
    ]);

    if (!habit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const progressMap = buildHabitProgressMap([habit], logs);

    return res.json({
      habit: serializeHabit(habit, categoryMap, progressMap.get(habit.habit_id)),
    });
  } catch (error) {
    console.error("Get habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/apply-overdue-punishments", requireUser, async (req, res) => {
  try {
    const requestedThroughDate =
      typeof req.body?.throughDate === "string" ? req.body.throughDate : null;
    const throughDateKey =
      requestedThroughDate && requestedThroughDate < toDateKey()
        ? requestedThroughDate
        : addDays(toDateKey(), -1);
    const result = await applyOverduePunishmentsForUser(
      req.userId,
      throughDateKey,
    );

    return res.json({
      appliedCount: result.appliedCount,
      totalHpPenalty: result.totalHpPenalty,
      throughDate: throughDateKey,
    });
  } catch (error) {
    console.error("Apply overdue punishments error:", error);
    return res.status(500).json({
      message: error?.message ?? "Internal server error.",
    });
  }
});

router.post("/:habitId/complete", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const { categoryMap, habit, character, existingLogs, todayLog } =
      await fetchHabitCompletionContext(
        req.userId,
        req.params.habitId,
        todayDateKey,
      );

    if (!habit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const nextStatus = isNegativeHabit(habit) ? "avoided" : "completed";

    if (todayLog?.status === nextStatus) {
      return res.json(
        buildCurrentProgressResponse(habit, categoryMap, existingLogs, todayDateKey),
      );
    }

    const result = await persistHabitStatus({
      userId: req.userId,
      habit,
      character,
      existingLogs,
      todayLog,
      dateKey: todayDateKey,
      status: nextStatus,
    });

    return res.json(
      buildProgressResponse(habit, categoryMap, result.progress, {
        ...result.rewards,
        logId: result.logId,
      }),
    );
  } catch (error) {
    console.error("Complete habit error:", error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? "Internal server error.",
    });
  }
});

router.delete("/:habitId/complete", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const { categoryMap, habit, character, existingLogs, todayLog } =
      await fetchHabitCompletionContext(
        req.userId,
        req.params.habitId,
        todayDateKey,
      );

    if (!habit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const result = await clearTodayHabitStatus({
      userId: req.userId,
      habit,
      character,
      existingLogs,
      todayLog,
      dateKey: todayDateKey,
      preserveExpOnClear: true,
    });

    return res.json(
      buildProgressResponse(habit, categoryMap, result.progress, result.rewards),
    );
  } catch (error) {
    console.error("Undo complete habit error:", error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? "Internal server error.",
    });
  }
});

router.post("/:habitId/status", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const requestedStatus =
      typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
    const { categoryMap, habit, character, existingLogs, todayLog } =
      await fetchHabitCompletionContext(
        req.userId,
        req.params.habitId,
        todayDateKey,
      );

    if (!habit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const result = await persistHabitStatus({
      userId: req.userId,
      habit,
      character,
      existingLogs,
      todayLog,
      dateKey: todayDateKey,
      status: requestedStatus,
      manualOnly: true,
    });

    return res.json(
      buildProgressResponse(habit, categoryMap, result.progress, {
        ...result.rewards,
        logId: result.logId,
      }),
    );
  } catch (error) {
    console.error("Update habit status error:", error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? "Internal server error.",
    });
  }
});

router.delete("/:habitId/status", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const { categoryMap, habit, character, existingLogs, todayLog } =
      await fetchHabitCompletionContext(
        req.userId,
        req.params.habitId,
        todayDateKey,
      );

    if (!habit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const result = await clearTodayHabitStatus({
      userId: req.userId,
      habit,
      character,
      existingLogs,
      todayLog,
      dateKey: todayDateKey,
    });

    return res.json(
      buildProgressResponse(habit, categoryMap, result.progress, result.rewards),
    );
  } catch (error) {
    console.error("Clear habit status error:", error);
    return res.status(error?.statusCode ?? 500).json({
      message: error?.message ?? "Internal server error.",
    });
  }
});

router.post("/", requireUser, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const categoryId = await resolveCategoryId(payload.categoryLabel);
    const habitPayload = buildHabitMutationPayload(payload, categoryId, {
      userId: req.userId,
      includeInsertDefaults: true,
    });

    const { data, error } = await supabase
      .from("habits")
      .insert(habitPayload)
      .select()
      .single();

    if (error) {
      console.error("Create habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    const categoryMap = await loadCategoryMap();

    return res.status(201).json({ habit: serializeHabit(data, categoryMap) });
  } catch (error) {
    console.error("Create habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.patch("/:habitId", requireUser, async (req, res) => {
  try {
    const existingHabit = await fetchHabitById(req.params.habitId, req.userId);

    if (!existingHabit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const categoryId = await resolveCategoryId(payload.categoryLabel);
    const habitPayload = buildHabitMutationPayload(payload, categoryId, {
      includeUpdatedAt: true,
    });

    const { data, error } = await supabase
      .from("habits")
      .update(habitPayload)
      .eq("habit_id", req.params.habitId)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error) {
      console.error("Update habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    const categoryMap = await loadCategoryMap();

    return res.json({ habit: serializeHabit(data, categoryMap) });
  } catch (error) {
    console.error("Update habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.delete("/:habitId", requireUser, async (req, res) => {
  try {
    const existingHabit = await fetchHabitById(req.params.habitId, req.userId);

    if (!existingHabit) {
      return res.status(404).json({ message: HABIT_NOT_FOUND_MESSAGE });
    }

    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("habit_id", req.params.habitId)
      .eq("user_id", req.userId);

    if (error) {
      console.error("Delete habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.aiHelpers = {
  fetchHabitCompletionContext,
  persistHabitStatus,
};

module.exports = router;
