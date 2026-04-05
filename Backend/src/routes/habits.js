const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const {
  ALL_DAY_NUMBERS,
  toFrequencyDayKeys,
  toFrequencyDayNumbers,
} = require("../utils/frequencyDays");
const {
  applyCharacterProgress,
  buildHabitProgressMap,
  calculateHabitStreak,
  isHabitScheduledOnDate,
  toDateKey,
} = require("../utils/habitProgress");

const router = express.Router();

const DEFAULT_REMINDER_BY_TIME = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "20:00",
};
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
  return (createdAt ?? new Date().toISOString()).split("T")[0];
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
    return {
      categoryLabel: null,
      preferredTime: "morning",
      startDate: getDefaultStartDate(createdAt),
      reminders: [getDefaultReminder("morning")],
    };
  }

  if (description.startsWith("Created from mobile habit form.")) {
    return parseFormDescription(description, createdAt);
  }

  if (description.startsWith("Created during onboarding.")) {
    return parseOnboardingDescription(description, createdAt);
  }

  return {
    categoryLabel: null,
    preferredTime: "morning",
    startDate: getDefaultStartDate(createdAt),
    reminders: [getDefaultReminder("morning")],
  };
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
    habitType: body?.habitType === "negative" ? "negative" : "positive",
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

function serializeHabit(habit, categoryMap, progress = {}) {
  const metadata = extractHabitMetadata(habit.description, habit.created_at);

  return {
    id: habit.habit_id,
    title: habit.title,
    habitType: habit.habit_type,
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
    .select("log_id, habit_id, log_date, status, hp_change, exp_change, streak_at_log")
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
    .select("log_id, habit_id, log_date, status, hp_change, exp_change, streak_at_log")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("log_date", dateKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchCharacter(userId) {
  const { data, error } = await supabase
    .from("characters")
    .select("character_id, level, current_hp, max_hp, current_exp, exp_to_next_level")
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
      return res.status(404).json({ message: "Habit not found." });
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

router.post("/:habitId/complete", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const [categoryMap, habit, character, existingLogs, todayLog] = await Promise.all([
      loadCategoryMap(),
      fetchHabitById(req.params.habitId, req.userId),
      fetchCharacter(req.userId),
      fetchHabitLogs(req.userId, req.params.habitId),
      fetchTodayHabitLog(req.userId, req.params.habitId, todayDateKey),
    ]);

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    if (!isHabitScheduledOnDate(habit, todayDateKey)) {
      return res.status(400).json({
        message: "This habit is not scheduled for today.",
      });
    }

    if (todayLog && (!todayLog.status || todayLog.status === "completed")) {
      const progressMap = buildHabitProgressMap([habit], existingLogs, todayDateKey);
      return res.json({
        habit: serializeHabit(habit, categoryMap, progressMap.get(habit.habit_id)),
        rewards: { exp: 0, hp: 0 },
      });
    }

    const completedDateKeys = existingLogs
      .filter((log) => !log.status || log.status === "completed")
      .map((log) => log.log_date);
    const nextStreak = calculateHabitStreak(
      habit,
      [...completedDateKeys, todayDateKey],
      todayDateKey,
    );
    const expChange =
      Number(habit.exp_reward ?? 0) +
      (nextStreak.currentStreak > 1 ? Number(habit.streak_bonus_exp ?? 0) : 0);
    const hpChange = Number(habit.hp_reward ?? 0);

    const { data: createdLog, error: createLogError } = await supabase
      .from("habit_logs")
      .insert({
        habit_id: habit.habit_id,
        user_id: req.userId,
        log_date: todayDateKey,
        status: "completed",
        value_recorded: Number(habit.target_value ?? 1),
        hp_change: hpChange,
        exp_change: expChange,
        streak_at_log: nextStreak.currentStreak,
        source: "manual",
      })
      .select("log_id")
      .single();

    if (createLogError) {
      console.error("Complete habit error:", createLogError);
      return res.status(400).json({ message: createLogError.message });
    }

    await Promise.all([
      syncHabitStreakRecord(req.userId, habit.habit_id, nextStreak),
      updateCharacterProgress(
        req.userId,
        character.character_id,
        applyCharacterProgress(character, expChange, hpChange),
      ),
    ]);

    return res.json({
      habit: serializeHabit(habit, categoryMap, {
        completedToday: true,
        currentStreak: nextStreak.currentStreak,
        bestStreak: nextStreak.bestStreak,
        lastCompletedAt: nextStreak.lastCompletedAt,
        isScheduledToday: true,
      }),
      rewards: {
        exp: expChange,
        hp: hpChange,
        logId: createdLog?.log_id ?? null,
      },
    });
  } catch (error) {
    console.error("Complete habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.delete("/:habitId/complete", requireUser, async (req, res) => {
  try {
    const todayDateKey = toDateKey();
    const [categoryMap, habit, character, existingLogs, todayLog] = await Promise.all([
      loadCategoryMap(),
      fetchHabitById(req.params.habitId, req.userId),
      fetchCharacter(req.userId),
      fetchHabitLogs(req.userId, req.params.habitId),
      fetchTodayHabitLog(req.userId, req.params.habitId, todayDateKey),
    ]);

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    if (!todayLog || (todayLog.status && todayLog.status !== "completed")) {
      const progressMap = buildHabitProgressMap([habit], existingLogs, todayDateKey);
      return res.json({
        habit: serializeHabit(habit, categoryMap, progressMap.get(habit.habit_id)),
        rewards: { exp: 0, hp: 0 },
      });
    }

    const { error: deleteLogError } = await supabase
      .from("habit_logs")
      .delete()
      .eq("log_id", todayLog.log_id);

    if (deleteLogError) {
      console.error("Undo complete habit error:", deleteLogError);
      return res.status(400).json({ message: deleteLogError.message });
    }

    const remainingDateKeys = existingLogs
      .filter(
        (log) =>
          log.log_id !== todayLog.log_id &&
          (!log.status || log.status === "completed"),
      )
      .map((log) => log.log_date);
    const nextStreak = calculateHabitStreak(habit, remainingDateKeys, todayDateKey);

    await Promise.all([
      syncHabitStreakRecord(req.userId, habit.habit_id, nextStreak),
      updateCharacterProgress(
        req.userId,
        character.character_id,
        applyCharacterProgress(
          character,
          -(todayLog.exp_change ?? 0),
          -(todayLog.hp_change ?? 0),
        ),
      ),
    ]);

    return res.json({
      habit: serializeHabit(habit, categoryMap, {
        completedToday: false,
        currentStreak: nextStreak.currentStreak,
        bestStreak: nextStreak.bestStreak,
        lastCompletedAt: nextStreak.lastCompletedAt,
        isScheduledToday: isHabitScheduledOnDate(habit, todayDateKey),
      }),
      rewards: {
        exp: -(todayLog.exp_change ?? 0),
        hp: -(todayLog.hp_change ?? 0),
      },
    });
  } catch (error) {
    console.error("Undo complete habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
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

    const habitPayload = {
      user_id: req.userId,
      category_id: categoryId,
      title: payload.trimmedTitle,
      description: buildDescription(payload),
      habit_type: payload.habitType,
      tracking_method: "boolean",
      target_value: payload.normalizedTargetValue,
      target_unit: payload.targetUnit,
      frequency_type: payload.normalizedFrequencyType,
      frequency_days: payload.normalizedDays,
      hp_reward: 10,
      exp_reward: 20,
      hp_penalty: 15,
      streak_bonus_exp: 5,
      is_active: true,
    };

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
      return res.status(404).json({ message: "Habit not found." });
    }

    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const categoryId = await resolveCategoryId(payload.categoryLabel);
    const habitPayload = {
      category_id: categoryId,
      title: payload.trimmedTitle,
      description: buildDescription(payload),
      habit_type: payload.habitType,
      target_value: payload.normalizedTargetValue,
      target_unit: payload.targetUnit,
      frequency_type: payload.normalizedFrequencyType,
      frequency_days: payload.normalizedDays,
      updated_at: new Date().toISOString(),
    };

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
      return res.status(404).json({ message: "Habit not found." });
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

module.exports = router;
