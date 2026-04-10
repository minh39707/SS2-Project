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
const {
  getHabitType,
  isNegativeHabit,
  isPositiveHabit,
  isSuccessStatus,
  isSuccessfulLogForHabit,
} = require("./habitStatus");

const DEFAULT_ANALYTICS_PERIOD = "week";
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
const ANALYTICS_PERIODS = new Set(["day", "week", "month", "year"]);

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

function normalizeAnalyticsPeriod(periodValue, daysValue = null) {
  if (typeof periodValue === "string") {
    const normalized = periodValue.trim().toLowerCase();

    if (ANALYTICS_PERIODS.has(normalized)) {
      return normalized;
    }
  }

  const parsedDays = Number.parseInt(daysValue, 10);

  if (parsedDays === 1) {
    return "day";
  }

  if (parsedDays >= 365) {
    return "year";
  }

  if (parsedDays >= 28) {
    return "month";
  }

  return DEFAULT_ANALYTICS_PERIOD;
}

function getPeriodStartDateKey(period, todayDateKey = toDateKey()) {
  const date = parseDateKey(todayDateKey);

  if (period === "day") {
    return todayDateKey;
  }

  if (period === "week") {
    const dayNumber = date.getDay();
    const mondayOffset = dayNumber === 0 ? -6 : 1 - dayNumber;
    date.setDate(date.getDate() + mondayOffset);
    return toDateKey(date);
  }

  if (period === "month") {
    return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  return toDateKey(new Date(date.getFullYear(), 0, 1));
}

function buildDateRange(period, todayDateKey = toDateKey()) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const startDateKey = getPeriodStartDateKey(normalizedPeriod, todayDateKey);
  const dateKeys = [];
  let cursor = startDateKey;

  while (cursor <= todayDateKey) {
    dateKeys.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return {
    period: normalizedPeriod,
    days: dateKeys.length,
    startDate: startDateKey,
    endDate: todayDateKey,
    dateKeys,
  };
}

function sumLogField(logs = [], fieldName) {
  return logs.reduce(
    (total, log) => total + Number(log?.[fieldName] ?? 0),
    0,
  );
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

function groupLogsByHabitDate(logs = []) {
  const logsByHabitDate = new Map();

  for (const log of logs) {
    if (!log?.habit_id || !log?.log_date) {
      continue;
    }

    const key = `${log.habit_id}:${toDateKey(log.log_date)}`;
    logsByHabitDate.set(key, log);
  }

  return logsByHabitDate;
}

function groupSuccessfulDateKeysByHabit(habits = [], logs = []) {
  const habitsById = new Map(
    habits.map((habit) => [habit.habit_id, habit]),
  );
  const successfulDatesByHabit = new Map();

  for (const log of logs) {
    if (!log?.habit_id || !log?.log_date) {
      continue;
    }

    const habit = habitsById.get(log.habit_id);

    if (!habit || !isSuccessfulLogForHabit(habit, log)) {
      continue;
    }

    const successfulDates = successfulDatesByHabit.get(log.habit_id) ?? [];
    successfulDates.push(toDateKey(log.log_date));
    successfulDatesByHabit.set(log.habit_id, successfulDates);
  }

  return successfulDatesByHabit;
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

function getPositiveDayStatus(log, dateKey, todayDateKey) {
  const status = log?.status ?? null;

  if (status === "completed") {
    return "completed";
  }

  if (status === "missed") {
    return "missed";
  }

  if (status === "punished") {
    return "punished";
  }

  if (dateKey < todayDateKey) {
    return "missed";
  }

  return null;
}

function getNegativeDayStatus(log) {
  const status = log?.status ?? null;

  if (status === "avoided") {
    return "avoided";
  }

  if (status === "failed") {
    return "failed";
  }

  return "unverified";
}

function buildEmptyPositiveMetrics() {
  return {
    scheduledCount: 0,
    completedCount: 0,
    missedCount: 0,
    punishedCount: 0,
    pendingCount: 0,
    completionRate: 0,
  };
}

function buildEmptyNegativeMetrics() {
  return {
    scheduledCount: 0,
    avoidedCount: 0,
    failedCount: 0,
    unverifiedCount: 0,
    avoidanceRate: 0,
  };
}

function finalizePositiveMetrics(metrics) {
  return {
    ...metrics,
    completionRate:
      metrics.scheduledCount > 0
        ? metrics.completedCount / metrics.scheduledCount
        : 0,
  };
}

function finalizeNegativeMetrics(metrics) {
  return {
    ...metrics,
    avoidanceRate:
      metrics.scheduledCount > 0
        ? metrics.avoidedCount / metrics.scheduledCount
        : 0,
  };
}

function buildRecentDaySummaries(habits, logsByDate, logsByHabitDate, dateRange, todayDateKey, streakDateSet) {
  return dateRange.dateKeys.map((dateKey) => {
    const logsForDate = logsByDate.get(dateKey) ?? [];
    const positive = buildEmptyPositiveMetrics();
    const negative = buildEmptyNegativeMetrics();

    for (const habit of habits) {
      if (!isHabitScheduledOnDate(habit, dateKey)) {
        continue;
      }

      const log = logsByHabitDate.get(`${habit.habit_id}:${dateKey}`) ?? null;

      if (isPositiveHabit(habit)) {
        positive.scheduledCount += 1;

        const status = getPositiveDayStatus(log, dateKey, todayDateKey);

        if (status === "completed") {
          positive.completedCount += 1;
        } else if (status === "missed") {
          positive.missedCount += 1;
        } else if (status === "punished") {
          positive.punishedCount += 1;
        } else {
          positive.pendingCount += 1;
        }

        continue;
      }

      negative.scheduledCount += 1;

      const status = getNegativeDayStatus(log);

      if (status === "avoided") {
        negative.avoidedCount += 1;
      } else if (status === "failed") {
        negative.failedCount += 1;
      } else {
        negative.unverifiedCount += 1;
      }
    }

    const finalizedPositive = finalizePositiveMetrics(positive);
    const finalizedNegative = finalizeNegativeMetrics(negative);
    const successCount =
      finalizedPositive.completedCount + finalizedNegative.avoidedCount;
    const scheduledCount =
      finalizedPositive.scheduledCount + finalizedNegative.scheduledCount;

    return {
      date: dateKey,
      label: formatDayLabel(dateKey),
      shortDate: formatShortDate(dateKey),
      scheduledCount,
      successCount,
      completedCount: successCount,
      missedCount:
        finalizedPositive.missedCount + finalizedPositive.punishedCount,
      expGained: sumLogField(logsForDate, "exp_change"),
      hpChange: sumLogField(logsForDate, "hp_change"),
      isToday: dateKey === todayDateKey,
      streak: streakDateSet.has(dateKey),
      hasActivity: logsForDate.length > 0 || scheduledCount > 0,
      good: finalizedPositive,
      bad: finalizedNegative,
    };
  });
}

function buildTopHabits(habits, logsByHabit, successfulDateKeysByHabit, dateRange, progressMap, todayDateKey) {
  const rangeDateSet = new Set(dateRange.dateKeys);

  return habits
    .map((habit) => {
      const habitLogs = logsByHabit.get(habit.habit_id) ?? [];
      const successfulDateKeys = successfulDateKeysByHabit.get(habit.habit_id) ?? [];
      const successfulDateSet = new Set(successfulDateKeys);
      const streak = calculateHabitStreak(habit, successfulDateKeys, todayDateKey);
      const habitLogsInRange = habitLogs.filter((log) =>
        rangeDateSet.has(toDateKey(log.log_date)),
      );
      const scheduledCount = dateRange.dateKeys.filter((dateKey) =>
        isHabitScheduledOnDate(habit, dateKey),
      ).length;
      const successCount = dateRange.dateKeys.filter(
        (dateKey) =>
          successfulDateSet.has(dateKey) && isHabitScheduledOnDate(habit, dateKey),
      ).length;
      const failedCount = habitLogsInRange.filter(
        (log) => log?.status === "failed",
      ).length;
      const punishedCount = habitLogsInRange.filter(
        (log) => log?.status === "punished",
      ).length;
      const missedCount = habitLogsInRange.filter(
        (log) => log?.status === "missed",
      ).length;
      const progress = progressMap.get(habit.habit_id) ?? {};

      return {
        id: habit.habit_id,
        title: habit.title,
        habitType: getHabitType(habit),
        scheduledCount,
        successCount,
        completedCount: isPositiveHabit(habit) ? successCount : 0,
        avoidedCount: isNegativeHabit(habit) ? successCount : 0,
        failedCount,
        missedCount,
        punishedCount,
        successRate: scheduledCount > 0 ? successCount / scheduledCount : 0,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        lastCompletedAt: streak.lastCompletedAt,
        totalExpGained: sumLogField(habitLogsInRange, "exp_change"),
        totalHpChange: sumLogField(habitLogsInRange, "hp_change"),
        isScheduledToday: progress.isScheduledToday ?? false,
        completedToday: progress.completedToday ?? false,
        todayStatus: progress.todayStatus ?? null,
      };
    })
    .sort((leftHabit, rightHabit) => {
      if (rightHabit.successCount !== leftHabit.successCount) {
        return rightHabit.successCount - leftHabit.successCount;
      }

      if (rightHabit.successRate !== leftHabit.successRate) {
        return rightHabit.successRate - leftHabit.successRate;
      }

      return rightHabit.currentStreak - leftHabit.currentStreak;
    });
}

function buildWeekdayBreakdown(recentDays = []) {
  const weekdayMap = new Map(
    WEEKDAY_KEY_ORDER.map((weekdayKey) => [
      weekdayKey,
      {
        key: weekdayKey,
        label: WEEKDAY_LABELS[weekdayKey],
        scheduledCount: 0,
        successCount: 0,
        completedCount: 0,
        avoidedCount: 0,
        missedCount: 0,
        punishedCount: 0,
        failedCount: 0,
        unverifiedCount: 0,
      },
    ]),
  );

  for (const day of recentDays) {
    const weekdayKey = getWeekdayKey(day.date);
    const entry = weekdayMap.get(weekdayKey);

    entry.scheduledCount += day.scheduledCount;
    entry.successCount += day.successCount;
    entry.completedCount += day.good.completedCount;
    entry.avoidedCount += day.bad.avoidedCount;
    entry.missedCount += day.good.missedCount;
    entry.punishedCount += day.good.punishedCount;
    entry.failedCount += day.bad.failedCount;
    entry.unverifiedCount += day.bad.unverifiedCount;
  }

  return WEEKDAY_KEY_ORDER.map((weekdayKey, index) => {
    const entry = weekdayMap.get(weekdayKey);

    return {
      ...entry,
      completionRate:
        entry.scheduledCount > 0
          ? entry.successCount / entry.scheduledCount
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
  const habitsById = new Map(habits.map((habit) => [habit.habit_id, habit]));
  const rangeDateSet = new Set(dateRange.dateKeys);
  const categoryCountMap = new Map();

  for (const log of logs) {
    if (!rangeDateSet.has(toDateKey(log.log_date))) {
      continue;
    }

    const habit = habitsById.get(log.habit_id);

    if (!habit || !isSuccessfulLogForHabit(habit, log)) {
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

function buildStreakHabits(habits, successfulDateKeysByHabit, categoryLabels, todayDateKey) {
  const categoriesByHabitId = buildCategoryMap(habits, categoryLabels);

  return assignCategoryColors(
    habits
      .map((habit) => {
        const successfulDateKeys = successfulDateKeysByHabit.get(habit.habit_id) ?? [];
        const streak = calculateHabitStreak(habit, successfulDateKeys, todayDateKey);

        return {
          id: habit.habit_id,
          title: habit.title,
          habitType: getHabitType(habit),
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

function buildHeatmap(recentDays = [], todayDateKey = toDateKey()) {
  const currentWeekStart = getCurrentWeekStart(todayDateKey);
  const firstWeekStart = addDays(currentWeekStart, -(HEATMAP_WEEKS - 1) * 7);
  const successCountMap = new Map();

  for (const day of recentDays) {
    successCountMap.set(day.date, day.successCount);
  }

  let maxSuccessCount = 0;
  const weeks = [];

  for (let weekIndex = 0; weekIndex < HEATMAP_WEEKS; weekIndex += 1) {
    const weekStart = addDays(firstWeekStart, weekIndex * 7);
    const days = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dateKey = addDays(weekStart, dayIndex);
      const successCount = successCountMap.get(dateKey) ?? 0;
      maxSuccessCount = Math.max(maxSuccessCount, successCount);
      days.push({
        date: dateKey,
        completedCount: successCount,
        successCount,
        isToday: dateKey === todayDateKey,
      });
    }

    weeks.push({
      weekStart,
      days,
    });
  }

  const intensityDivisor = Math.max(maxSuccessCount, 1);

  return {
    weeks: weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => ({
        ...day,
        intensity:
          day.successCount === 0
            ? 0
            : Math.max(1, Math.ceil((day.successCount / intensityDivisor) * 4)),
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

function buildAnalyticsSummary(recentDays, habits, topHabits, activeGlobalStreak) {
  const good = recentDays.reduce(
    (totals, day) => ({
      scheduledCount: totals.scheduledCount + day.good.scheduledCount,
      completedCount: totals.completedCount + day.good.completedCount,
      missedCount: totals.missedCount + day.good.missedCount,
      punishedCount: totals.punishedCount + day.good.punishedCount,
    }),
    {
      scheduledCount: 0,
      completedCount: 0,
      missedCount: 0,
      punishedCount: 0,
    },
  );
  const bad = recentDays.reduce(
    (totals, day) => ({
      scheduledCount: totals.scheduledCount + day.bad.scheduledCount,
      avoidedCount: totals.avoidedCount + day.bad.avoidedCount,
      failedCount: totals.failedCount + day.bad.failedCount,
      unverifiedCount: totals.unverifiedCount + day.bad.unverifiedCount,
    }),
    {
      scheduledCount: 0,
      avoidedCount: 0,
      failedCount: 0,
      unverifiedCount: 0,
    },
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
    successCount: 0,
    good: buildEmptyPositiveMetrics(),
    bad: buildEmptyNegativeMetrics(),
  };
  const bestHabitStreak = topHabits.reduce(
    (highestStreak, habit) => Math.max(highestStreak, habit.bestStreak ?? 0),
    0,
  );
  const finalizedGood = {
    ...good,
    completionRate:
      good.scheduledCount > 0 ? good.completedCount / good.scheduledCount : 0,
    dueTodayCount: todaySummary.good.scheduledCount,
    completedTodayCount: todaySummary.good.completedCount,
    remainingTodayCount: Math.max(
      todaySummary.good.scheduledCount - todaySummary.good.completedCount,
      0,
    ),
  };
  const finalizedBad = {
    ...bad,
    avoidanceRate:
      bad.scheduledCount > 0 ? bad.avoidedCount / bad.scheduledCount : 0,
    dueTodayCount: todaySummary.bad.scheduledCount,
    avoidedTodayCount: todaySummary.bad.avoidedCount,
    unverifiedTodayCount: todaySummary.bad.unverifiedCount,
  };
  const scheduledCount = good.scheduledCount + bad.scheduledCount;
  const successCount = good.completedCount + bad.avoidedCount;

  return {
    scheduledCount,
    successCount,
    completedCount: good.completedCount,
    missedCount: good.missedCount,
    punishedCount: good.punishedCount,
    avoidedCount: bad.avoidedCount,
    failedCount: bad.failedCount,
    unverifiedCount: bad.unverifiedCount,
    totalExpGained,
    totalHpChange,
    completionRate: finalizedGood.completionRate,
    avoidanceRate: finalizedBad.avoidanceRate,
    activeDays: recentDays.filter((day) => day.successCount > 0).length,
    activeHabitCount: habits.filter((habit) => habit.is_active !== false).length,
    activeGlobalStreak,
    bestHabitStreak,
    dueTodayCount: todaySummary.scheduledCount,
    completedTodayCount: todaySummary.good.completedCount,
    remainingTodayCount: Math.max(
      todaySummary.good.scheduledCount - todaySummary.good.completedCount,
      0,
    ),
    goodHabits: finalizedGood,
    badHabits: finalizedBad,
  };
}

function buildUserAnalyticsPayload({
  character = null,
  habits = [],
  logs = [],
  categoryLabels = {},
  days = null,
  period = DEFAULT_ANALYTICS_PERIOD,
  todayDateKey = toDateKey(),
}) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period, days);
  const dateRange = buildDateRange(normalizedPeriod, todayDateKey);
  const progressMap = buildHabitProgressMap(habits, logs, todayDateKey);
  const logsByDate = groupLogsByDate(logs);
  const logsByHabit = groupLogsByHabit(logs);
  const logsByHabitDate = groupLogsByHabitDate(logs);
  const successfulDateKeysByHabit = groupSuccessfulDateKeysByHabit(habits, logs);
  const successfulLogs = logs.filter((log) => isSuccessStatus(log?.status));
  const successfulDateKeys = successfulLogs.map((log) => toDateKey(log.log_date));
  const { streak: activeGlobalStreak, streakDateKeys } = calculateGlobalStreak(
    successfulDateKeys,
    todayDateKey,
  );
  const streakDateSet = new Set(streakDateKeys);
  const recentDays = buildRecentDaySummaries(
    habits,
    logsByDate,
    logsByHabitDate,
    dateRange,
    todayDateKey,
    streakDateSet,
  );
  const topHabits = buildTopHabits(
    habits,
    logsByHabit,
    successfulDateKeysByHabit,
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
  const activityHeatmap = buildHeatmap(recentDays, todayDateKey);
  const weekdayBreakdown = buildWeekdayBreakdown(recentDays);
  const categoryBreakdown = buildCategoryBreakdown(
    habits,
    logs,
    categoryLabels,
    dateRange,
  );
  const streakHabits = buildStreakHabits(
    habits,
    successfulDateKeysByHabit,
    categoryLabels,
    todayDateKey,
  );

  return {
    range: {
      period: normalizedPeriod,
      days: dateRange.days,
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
  normalizeAnalyticsPeriod,
};
