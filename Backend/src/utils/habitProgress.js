const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SCHEDULE_LOOKBACK_DAYS = 370;

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(value = new Date()) {
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

function parseDateKey(dateKey) {
  const normalizedDateKey = toDateKey(dateKey);
  const [year, month, day] = normalizedDateKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function addDays(dateKey, dayDelta) {
  const nextDate = parseDateKey(dateKey);
  nextDate.setDate(nextDate.getDate() + dayDelta);
  return toDateKey(nextDate);
}

function getMondayDayNumber(dateKey) {
  const dayNumber = parseDateKey(dateKey).getDay();
  return dayNumber === 0 ? 7 : dayNumber;
}

function getDaysInMonth(dateKey) {
  const date = parseDateKey(dateKey);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getHabitStartDate(habit) {
  const descriptionStartDateMatch =
    typeof habit?.description === "string"
      ? habit.description.match(/Start date:\s(\d{4}-\d{2}-\d{2})\./i)
      : null;

  return descriptionStartDateMatch?.[1] ?? toDateKey(habit?.created_at ?? new Date());
}

function isHabitScheduledOnDate(habit, dateKey) {
  if (!habit || habit.is_active === false) {
    return false;
  }

  const normalizedDateKey = toDateKey(dateKey);
  const startDateKey = getHabitStartDate(habit);

  if (normalizedDateKey < startDateKey) {
    return false;
  }

  if (habit.frequency_type === "weekly") {
    const frequencyDays = Array.isArray(habit.frequency_days)
      ? habit.frequency_days.map(Number)
      : [];

    return frequencyDays.includes(getMondayDayNumber(normalizedDateKey));
  }

  if (habit.frequency_type === "monthly") {
    const startDate = parseDateKey(startDateKey);
    const targetDate = parseDateKey(normalizedDateKey);
    const scheduledDay = Math.min(
      startDate.getDate(),
      getDaysInMonth(normalizedDateKey),
    );

    return targetDate.getDate() === scheduledDay;
  }

  return true;
}

function getLatestScheduledDateOnOrBefore(habit, dateKey) {
  let cursor = toDateKey(dateKey);

  for (let index = 0; index < MAX_SCHEDULE_LOOKBACK_DAYS; index += 1) {
    if (isHabitScheduledOnDate(habit, cursor)) {
      return cursor;
    }

    cursor = addDays(cursor, -1);
  }

  return null;
}

function getPreviousScheduledDate(habit, dateKey) {
  return getLatestScheduledDateOnOrBefore(habit, dateKey);
}

function getLatestDateKey(dateKeys = []) {
  return [...new Set(dateKeys.map(toDateKey))].sort().at(-1) ?? null;
}

function calculateBestHabitStreak(habit, completedDateKeys = []) {
  const completedSet = new Set(completedDateKeys.map(toDateKey));
  const sortedDateKeys = [...completedSet].sort();
  const streakByDate = new Map();
  let bestStreak = 0;

  for (const dateKey of sortedDateKeys) {
    if (!isHabitScheduledOnDate(habit, dateKey)) {
      continue;
    }

    const previousScheduledDate = getPreviousScheduledDate(
      habit,
      addDays(dateKey, -1),
    );
    const previousStreak =
      previousScheduledDate && completedSet.has(previousScheduledDate)
        ? streakByDate.get(previousScheduledDate) ?? 0
        : 0;
    const currentStreak = previousStreak + 1;

    streakByDate.set(dateKey, currentStreak);
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  return bestStreak;
}

function calculateHabitStreak(habit, completedDateKeys = [], todayDateKey = toDateKey()) {
  const completedSet = new Set(completedDateKeys.map(toDateKey));
  const latestCompletedAt = getLatestDateKey(completedDateKeys);
  const latestScheduledDate = getLatestScheduledDateOnOrBefore(habit, todayDateKey);
  let anchorDate = null;

  if (latestScheduledDate && completedSet.has(latestScheduledDate)) {
    anchorDate = latestScheduledDate;
  } else if (latestScheduledDate === todayDateKey) {
    anchorDate = getPreviousScheduledDate(habit, addDays(todayDateKey, -1));
  } else {
    anchorDate = null;
  }

  if (!anchorDate || !completedSet.has(anchorDate)) {
    return {
      currentStreak: 0,
      bestStreak: calculateBestHabitStreak(habit, completedDateKeys),
      lastCompletedAt: latestCompletedAt,
    };
  }

  let currentStreak = 0;
  let cursor = anchorDate;

  while (cursor && completedSet.has(cursor)) {
    currentStreak += 1;
    cursor = getPreviousScheduledDate(habit, addDays(cursor, -1));
  }

  return {
    currentStreak,
    bestStreak: calculateBestHabitStreak(habit, completedDateKeys),
    lastCompletedAt: latestCompletedAt,
  };
}

function calculateGlobalStreak(completedDateKeys = [], todayDateKey = toDateKey()) {
  const completedSet = new Set(completedDateKeys.map(toDateKey));
  let anchorDate = null;

  if (completedSet.has(todayDateKey)) {
    anchorDate = todayDateKey;
  } else {
    const yesterdayDateKey = addDays(todayDateKey, -1);

    if (completedSet.has(yesterdayDateKey)) {
      anchorDate = yesterdayDateKey;
    }
  }

  if (!anchorDate) {
    return { streak: 0, streakDateKeys: [] };
  }

  const streakDateKeys = [];
  let cursor = anchorDate;

  while (completedSet.has(cursor)) {
    streakDateKeys.push(cursor);
    cursor = addDays(cursor, -1);
  }

  return {
    streak: streakDateKeys.length,
    streakDateKeys,
  };
}

function groupCompletedLogsByHabit(logs = []) {
  const groupedLogs = new Map();

  for (const log of logs) {
    if (!log?.habit_id || !log?.log_date) {
      continue;
    }

    if (log.status && log.status !== "completed") {
      continue;
    }

    const dateKeys = groupedLogs.get(log.habit_id) ?? [];
    dateKeys.push(toDateKey(log.log_date));
    groupedLogs.set(log.habit_id, dateKeys);
  }

  return groupedLogs;
}

function buildHabitProgressMap(habits = [], logs = [], todayDateKey = toDateKey()) {
  const completedLogsByHabit = groupCompletedLogsByHabit(logs);
  const progressMap = new Map();

  for (const habit of habits) {
    const completedDateKeys = completedLogsByHabit.get(habit.habit_id) ?? [];
    const streak = calculateHabitStreak(habit, completedDateKeys, todayDateKey);

    progressMap.set(habit.habit_id, {
      completedToday: completedDateKeys.includes(todayDateKey),
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      lastCompletedAt: streak.lastCompletedAt,
      isScheduledToday: isHabitScheduledOnDate(habit, todayDateKey),
    });
  }

  return progressMap;
}

function buildWeekCalendar(habits = [], logs = [], todayDateKey = toDateKey()) {
  const todayDate = parseDateKey(todayDateKey);
  const currentDay = todayDate.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const mondayDate = new Date(todayDate);
  mondayDate.setDate(todayDate.getDate() + mondayOffset);

  const completedDateSet = new Set(
    logs
      .filter((log) => !log.status || log.status === "completed")
      .map((log) => toDateKey(log.log_date)),
  );
  const { streakDateKeys } = calculateGlobalStreak([...completedDateSet], todayDateKey);
  const streakDateSet = new Set(streakDateKeys);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return dayLabels.map((label, index) => {
    const currentDate = new Date(mondayDate);
    currentDate.setDate(mondayDate.getDate() + index);

    const dateKey = toDateKey(currentDate);
    const isSelected = dateKey === todayDateKey;
    const hasCompletedHabit = completedDateSet.has(dateKey);
    const hasScheduledHabit = habits.some((habit) =>
      isHabitScheduledOnDate(habit, dateKey),
    );

    let status = "empty";

    if (hasCompletedHabit) {
      status = "done";
    } else if (isSelected) {
      status = "warning";
    } else if (hasScheduledHabit && dateKey < todayDateKey) {
      status = "missed";
    }

    return {
      label,
      date: currentDate.getDate(),
      status,
      isSelected,
      streak: streakDateSet.has(dateKey),
      dateKey,
    };
  });
}

function summarizeDailyProgress(habits = [], progressMap, todayDateKey = toDateKey()) {
  const scheduledHabits = habits.filter((habit) =>
    isHabitScheduledOnDate(habit, todayDateKey),
  );
  const completedCount = scheduledHabits.filter(
    (habit) => progressMap.get(habit.habit_id)?.completedToday,
  ).length;
  const totalCount = scheduledHabits.length;

  return {
    completedCount,
    totalCount,
    ratio: totalCount > 0 ? completedCount / totalCount : 0,
  };
}

function applyCharacterProgress(character, expChange = 0, hpChange = 0) {
  const maxHp = Math.max(1, character?.max_hp ?? 100);
  const expToNextLevel = Math.max(1, character?.exp_to_next_level ?? 100);
  let level = Math.max(1, character?.level ?? 1);
  let currentExp = Math.max(0, character?.current_exp ?? 0) + expChange;

  while (currentExp >= expToNextLevel) {
    currentExp -= expToNextLevel;
    level += 1;
  }

  while (currentExp < 0 && level > 1) {
    currentExp += expToNextLevel;
    level -= 1;
  }

  if (currentExp < 0) {
    currentExp = 0;
  }

  return {
    level,
    current_exp: currentExp,
    exp_to_next_level: expToNextLevel,
    current_hp: Math.max(
      0,
      Math.min(maxHp, (character?.current_hp ?? maxHp) + hpChange),
    ),
    max_hp: maxHp,
    updated_at: new Date().toISOString(),
  };
}

function buildPlayerSummary(character, streak = 0) {
  return {
    level: character?.level ?? 1,
    currentHp: character?.current_hp ?? 100,
    maxHp: character?.max_hp ?? 100,
    currentExp: character?.current_exp ?? 0,
    expToNextLevel: character?.exp_to_next_level ?? 100,
    streak,
  };
}

function buildStats(character, streak = 0) {
  const player = buildPlayerSummary(character, streak);

  return [
    {
      label: "HP",
      value: player.currentHp,
      max: player.maxHp,
      color: "#EF4444",
      icon: "heart",
    },
    {
      label: "EXP",
      value: player.currentExp,
      max: player.expToNextLevel,
      color: "#3B82F6",
      icon: "flash",
    },
    {
      label: "Streaks",
      value: player.streak,
      max: Math.max(7, player.streak || 0),
      color: "#F59E0B",
      icon: "flame",
    },
  ];
}

module.exports = {
  addDays,
  applyCharacterProgress,
  buildHabitProgressMap,
  buildPlayerSummary,
  buildStats,
  buildWeekCalendar,
  calculateHabitStreak,
  calculateGlobalStreak,
  getHabitStartDate,
  isHabitScheduledOnDate,
  summarizeDailyProgress,
  toDateKey,
};
