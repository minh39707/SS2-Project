const {
  addDays,
  buildHabitProgressMap,
  buildPlayerSummary,
  buildStats,
  calculateGlobalStreak,
  calculateHabitStreak,
  isHabitScheduledOnDate,
  toDateKey,
} = require("./habitProgress");

const DEFAULT_ANALYTICS_RANGE_DAYS = 7;
const MAX_ANALYTICS_RANGE_DAYS = 90;
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const WEEKDAY_KEY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const CATEGORY_COLORS = [
  "#22A06B",
  "#7C6AE6",
  "#F59E0B",
  "#94A3B8",
  "#3B82F6",
  "#EC4899",
];
const HEATMAP_WEEKS = 26;

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekdayKey(dateKey) {
  const dayNumber = parseDateKey(dateKey).getDay();

  return WEEKDAY_KEY_ORDER[(dayNumber + 6) % 7];
}

function formatDayLabel(dateKey) {
  return DAY_LABEL_FORMATTER.format(parseDateKey(dateKey));
}

function formatShortDate(dateKey) {
  return SHORT_DATE_FORMATTER.format(parseDateKey(dateKey));
}

function normalizeAnalyticsDays(daysValue) {
  const parsedValue = Number.parseInt(daysValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_ANALYTICS_RANGE_DAYS;
  }

  return Math.min(Math.max(parsedValue, 1), MAX_ANALYTICS_RANGE_DAYS);
}

function isCompletedLog(log) {
  return !log?.status || log.status === "completed";
}

function sumLogField(logs = [], fieldName) {
  return logs.reduce(
    (total, log) => total + Number(log?.[fieldName] ?? 0),
    0,
  );
}

function buildDateRange(days, todayDateKey = toDateKey()) {
  const startDateKey = addDays(todayDateKey, -(days - 1));
  const dateKeys = [];

  for (let index = 0; index < days; index += 1) {
    dateKeys.push(addDays(startDateKey, index));
  }

  return {
    days,
    startDate: startDateKey,
    endDate: todayDateKey,
    dateKeys,
  };
}

function groupLogsByDate(logs = []) {
  const logsByDate = new Map();

  for (const log of logs) {
    if (!log?.log_date) {
      continue;
    }

    const dateKey = toDateKey(log.log_date);
    const existingLogs = logsByDate.get(dateKey) ?? [];
    existingLogs.push(log);
    logsByDate.set(dateKey, existingLogs);
  }

  return logsByDate;
}

function groupLogsByHabit(logs = []) {
  const logsByHabit = new Map();

  for (const log of logs) {
    if (!log?.habit_id) {
      continue;
    }

    const existingLogs = logsByHabit.get(log.habit_id) ?? [];
    existingLogs.push(log);
    logsByHabit.set(log.habit_id, existingLogs);
  }

  return logsByHabit;
}

function groupCompletedDateKeysByHabit(logs = []) {
  const completedDatesByHabit = new Map();

  for (const log of logs) {
    if (!log?.habit_id || !log?.log_date || !isCompletedLog(log)) {
      continue;
    }

    const completedDateKeys = completedDatesByHabit.get(log.habit_id) ?? [];
    completedDateKeys.push(toDateKey(log.log_date));
    completedDatesByHabit.set(log.habit_id, completedDateKeys);
  }

  return completedDatesByHabit;
}

function buildCategoryMap(habits = [], categoryLabels = {}) {
  const categoriesByHabitId = new Map();

  for (const habit of habits) {
    const fallbackCategoryLabel =
      typeof habit?.description === "string"
        ? habit.description.match(/Category:\s(.+?)\./i)?.[1] ??
          habit.description.match(/Area:\s(.+?)\.\sScheduled:/i)?.[1] ??
          null
        : null;
    const categoryLabel =
      categoryLabels?.[habit.category_id] ??
      fallbackCategoryLabel ??
      "Other";

    categoriesByHabitId.set(habit.habit_id, categoryLabel);
  }

  return categoriesByHabitId;
}

function assignCategoryColors(categoryEntries = []) {
  return categoryEntries.map((entry, index) => ({
    ...entry,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
}

function getCurrentWeekStart(todayDateKey) {
  return addDays(todayDateKey, -WEEKDAY_KEY_ORDER.indexOf(getWeekdayKey(todayDateKey)));
}

function buildHeatmap(logsByDate, todayDateKey = toDateKey()) {
  const currentWeekStart = getCurrentWeekStart(todayDateKey);
  const firstWeekStart = addDays(currentWeekStart, -(HEATMAP_WEEKS - 1) * 7);
  const dateCountMap = new Map();

  for (const [dateKey, logsForDate] of logsByDate.entries()) {
    const completedCount = logsForDate.filter(isCompletedLog).length;
    dateCountMap.set(dateKey, completedCount);
  }

  let maxCompletedCount = 0;
  const weeks = [];

  for (let weekIndex = 0; weekIndex < HEATMAP_WEEKS; weekIndex += 1) {
    const weekStart = addDays(firstWeekStart, weekIndex * 7);
    const days = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dateKey = addDays(weekStart, dayIndex);
      const completedCount = dateCountMap.get(dateKey) ?? 0;
      maxCompletedCount = Math.max(maxCompletedCount, completedCount);
      days.push({
        date: dateKey,
        completedCount,
        isToday: dateKey === todayDateKey,
      });
    }

    weeks.push({
      weekStart,
      days,
    });
  }

  const intensityDivisor = Math.max(maxCompletedCount, 1);

  return {
    weeks: weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => ({
        ...day,
        intensity:
          day.completedCount === 0
            ? 0
            : Math.max(1, Math.ceil((day.completedCount / intensityDivisor) * 4)),
      })),
    })),
    legend: [
      { level: 0, label: "Less" },
      { level: 1, label: "" },
      { level: 2, label: "" },
      { level: 3, label: "" },
      { level: 4, label: "More" },
    ],
  };
}

function buildRecentDaySummaries(habits, logsByDate, dateRange, todayDateKey, streakDateSet) {
  return dateRange.dateKeys.map((dateKey) => {
    const logsForDate = logsByDate.get(dateKey) ?? [];
    const completedHabitIds = new Set(
      logsForDate
        .filter(isCompletedLog)
        .map((log) => log.habit_id)
        .filter(Boolean),
    );
    const scheduledHabits = habits.filter((habit) =>
      isHabitScheduledOnDate(habit, dateKey),
    );
    const scheduledCount = scheduledHabits.length;
    const completedCount = scheduledHabits.filter((habit) =>
      completedHabitIds.has(habit.habit_id),
    ).length;
    const missedCount =
      dateKey < todayDateKey ? Math.max(scheduledCount - completedCount, 0) : 0;
    const completionRate =
      scheduledCount > 0 ? completedCount / scheduledCount : 0;

    return {
      date: dateKey,
      label: formatDayLabel(dateKey),
      shortDate: formatShortDate(dateKey),
      completedCount,
      missedCount,
      scheduledCount,
      completionRate,
      expGained: sumLogField(logsForDate, "exp_change"),
      hpChange: sumLogField(logsForDate, "hp_change"),
      isToday: dateKey === todayDateKey,
      streak: streakDateSet.has(dateKey),
      hasActivity: logsForDate.length > 0 || scheduledCount > 0,
    };
  });
}

function buildTopHabits(habits, logsByHabit, completedDateKeysByHabit, dateRange, progressMap, todayDateKey) {
  const rangeDateSet = new Set(dateRange.dateKeys);

  return habits
    .map((habit) => {
      const habitLogs = logsByHabit.get(habit.habit_id) ?? [];
      const completedDateKeys = completedDateKeysByHabit.get(habit.habit_id) ?? [];
      const completedDateSet = new Set(completedDateKeys);
      const streak = calculateHabitStreak(habit, completedDateKeys, todayDateKey);
      const habitLogsInRange = habitLogs.filter((log) =>
        rangeDateSet.has(toDateKey(log.log_date)),
      );
      const scheduledCount = dateRange.dateKeys.filter((dateKey) =>
        isHabitScheduledOnDate(habit, dateKey),
      ).length;
      const completedCount = dateRange.dateKeys.filter(
        (dateKey) =>
          completedDateSet.has(dateKey) && isHabitScheduledOnDate(habit, dateKey),
      ).length;
      const completionRate =
        scheduledCount > 0 ? completedCount / scheduledCount : 0;
      const progress = progressMap.get(habit.habit_id) ?? {};

      return {
        id: habit.habit_id,
        title: habit.title,
        completedCount,
        scheduledCount,
        completionRate,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        lastCompletedAt: streak.lastCompletedAt,
        totalExpGained: sumLogField(habitLogsInRange, "exp_change"),
        totalHpChange: sumLogField(habitLogsInRange, "hp_change"),
        isScheduledToday: progress.isScheduledToday ?? false,
        completedToday: progress.completedToday ?? false,
      };
    })
    .sort((leftHabit, rightHabit) => {
      if (rightHabit.completedCount !== leftHabit.completedCount) {
        return rightHabit.completedCount - leftHabit.completedCount;
      }

      if (rightHabit.completionRate !== leftHabit.completionRate) {
        return rightHabit.completionRate - leftHabit.completionRate;
      }

      return rightHabit.currentStreak - leftHabit.currentStreak;
    })
    .slice(0, 5);
}

function buildWeekdayBreakdown(recentDays = []) {
  const weekdayMap = new Map(
    WEEKDAY_KEY_ORDER.map((weekdayKey) => [
      weekdayKey,
      {
        key: weekdayKey,
        label: WEEKDAY_LABELS[weekdayKey],
        completedCount: 0,
        scheduledCount: 0,
        missedCount: 0,
      },
    ]),
  );

  for (const day of recentDays) {
    const weekdayKey = getWeekdayKey(day.date);
    const entry = weekdayMap.get(weekdayKey);

    entry.completedCount += day.completedCount;
    entry.scheduledCount += day.scheduledCount;
    entry.missedCount += day.missedCount;
  }

  return WEEKDAY_KEY_ORDER.map((weekdayKey, index) => {
    const entry = weekdayMap.get(weekdayKey);

    return {
      ...entry,
      completionRate:
        entry.scheduledCount > 0
          ? entry.completedCount / entry.scheduledCount
          : 0,
      color:
        index < 5
          ? index < 2
            ? "#7CB518"
            : "#4D7C0F"
          : index === 5
            ? "#F59E0B"
            : "#EF4444",
    };
  });
}

function buildCategoryBreakdown(habits, logs = [], categoryLabels = {}, dateRange) {
  const categoriesByHabitId = buildCategoryMap(habits, categoryLabels);
  const rangeDateSet = new Set(dateRange.dateKeys);
  const categoryCountMap = new Map();

  for (const log of logs) {
    if (!isCompletedLog(log) || !rangeDateSet.has(toDateKey(log.log_date))) {
      continue;
    }

    const categoryLabel = categoriesByHabitId.get(log.habit_id) ?? "Other";
    categoryCountMap.set(
      categoryLabel,
      (categoryCountMap.get(categoryLabel) ?? 0) + 1,
    );
  }

  if (categoryCountMap.size === 0) {
    for (const habit of habits) {
      const categoryLabel = categoriesByHabitId.get(habit.habit_id) ?? "Other";
      categoryCountMap.set(
        categoryLabel,
        (categoryCountMap.get(categoryLabel) ?? 0) + 1,
      );
    }
  }

  const totalCount = [...categoryCountMap.values()].reduce(
    (sum, count) => sum + count,
    0,
  );

  return assignCategoryColors(
    [...categoryCountMap.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage: totalCount > 0 ? count / totalCount : 0,
      }))
      .sort((leftCategory, rightCategory) => rightCategory.count - leftCategory.count)
      .slice(0, 4),
  );
}

function buildStreakHabits(habits, completedDateKeysByHabit, categoryLabels, todayDateKey) {
  const categoriesByHabitId = buildCategoryMap(habits, categoryLabels);

  return assignCategoryColors(
    habits
      .map((habit) => {
        const completedDateKeys = completedDateKeysByHabit.get(habit.habit_id) ?? [];
        const streak = calculateHabitStreak(habit, completedDateKeys, todayDateKey);

        return {
          id: habit.habit_id,
          title: habit.title,
          categoryLabel: categoriesByHabitId.get(habit.habit_id) ?? "Other",
          currentStreak: streak.currentStreak,
          bestStreak: streak.bestStreak,
          lastCompletedAt: streak.lastCompletedAt,
        };
      })
      .filter(
        (habit) =>
          (habit.currentStreak ?? 0) > 0 ||
          (habit.bestStreak ?? 0) > 0 ||
          !!habit.lastCompletedAt,
      )
      .sort((leftHabit, rightHabit) => {
        if (rightHabit.currentStreak !== leftHabit.currentStreak) {
          return rightHabit.currentStreak - leftHabit.currentStreak;
        }

        return rightHabit.bestStreak - leftHabit.bestStreak;
      }),
  );
}

function buildAnalyticsSummary(recentDays, habits, topHabits, activeGlobalStreak) {
  const scheduledCount = recentDays.reduce(
    (total, day) => total + day.scheduledCount,
    0,
  );
  const completedCount = recentDays.reduce(
    (total, day) => total + day.completedCount,
    0,
  );
  const missedCount = recentDays.reduce(
    (total, day) => total + day.missedCount,
    0,
  );
  const totalExpGained = recentDays.reduce(
    (total, day) => total + day.expGained,
    0,
  );
  const totalHpChange = recentDays.reduce(
    (total, day) => total + day.hpChange,
    0,
  );
  const todaySummary = recentDays.at(-1) ?? {
    scheduledCount: 0,
    completedCount: 0,
  };
  const bestHabitStreak = topHabits.reduce(
    (highestStreak, habit) => Math.max(highestStreak, habit.bestStreak ?? 0),
    0,
  );

  return {
    scheduledCount,
    completedCount,
    missedCount,
    totalExpGained,
    totalHpChange,
    completionRate: scheduledCount > 0 ? completedCount / scheduledCount : 0,
    activeDays: recentDays.filter((day) => day.completedCount > 0).length,
    activeHabitCount: habits.filter((habit) => habit.is_active !== false).length,
    activeGlobalStreak,
    bestHabitStreak,
    dueTodayCount: todaySummary.scheduledCount,
    completedTodayCount: todaySummary.completedCount,
    remainingTodayCount: Math.max(
      todaySummary.scheduledCount - todaySummary.completedCount,
      0,
    ),
  };
}

function buildUserAnalyticsPayload({
  character = null,
  habits = [],
  logs = [],
  categoryLabels = {},
  days = DEFAULT_ANALYTICS_RANGE_DAYS,
  todayDateKey = toDateKey(),
}) {
  const normalizedDays = normalizeAnalyticsDays(days);
  const dateRange = buildDateRange(normalizedDays, todayDateKey);
  const completedLogs = logs.filter(isCompletedLog);
  const completedDateKeys = completedLogs.map((log) => toDateKey(log.log_date));
  const { streak: activeGlobalStreak, streakDateKeys } = calculateGlobalStreak(
    completedDateKeys,
    todayDateKey,
  );
  const streakDateSet = new Set(streakDateKeys);
  const progressMap = buildHabitProgressMap(habits, logs, todayDateKey);
  const logsByDate = groupLogsByDate(logs);
  const logsByHabit = groupLogsByHabit(logs);
  const completedDateKeysByHabit = groupCompletedDateKeysByHabit(logs);
  const recentDays = buildRecentDaySummaries(
    habits,
    logsByDate,
    dateRange,
    todayDateKey,
    streakDateSet,
  );
  const topHabits = buildTopHabits(
    habits,
    logsByHabit,
    completedDateKeysByHabit,
    dateRange,
    progressMap,
    todayDateKey,
  );
  const summary = buildAnalyticsSummary(
    recentDays,
    habits,
    topHabits,
    activeGlobalStreak,
  );
  const activityHeatmap = buildHeatmap(logsByDate, todayDateKey);
  const weekdayBreakdown = buildWeekdayBreakdown(recentDays);
  const categoryBreakdown = buildCategoryBreakdown(
    habits,
    logs,
    categoryLabels,
    dateRange,
  );
  const streakHabits = buildStreakHabits(
    habits,
    completedDateKeysByHabit,
    categoryLabels,
    todayDateKey,
  );

  return {
    range: {
      days: normalizedDays,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    summary,
    player: buildPlayerSummary(character, activeGlobalStreak),
    stats: buildStats(character, activeGlobalStreak),
    activityHeatmap,
    weekdayBreakdown,
    categoryBreakdown,
    streakHabits,
    recentDays,
    topHabits,
    generatedAt: new Date().toISOString(),
    source: "derived_from_habits_and_logs",
  };
}

module.exports = {
  buildUserAnalyticsPayload,
  normalizeAnalyticsDays,
};
