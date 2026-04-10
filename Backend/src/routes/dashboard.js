const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const { toFrequencyDayKeys } = require("../utils/frequencyDays");
const {
  buildHabitProgressMap,
  buildPlayerSummary,
  buildStats,
  buildWeekCalendar,
  calculateGlobalStreak,
  summarizeDailyProgress,
} = require("../utils/habitProgress");
const { getHabitType, isNegativeHabit, isSuccessStatus } = require("../utils/habitStatus");

const router = express.Router();
const ONBOARDING_DESCRIPTION_PREFIX = "Created during onboarding.";

function normalizeHabitsForDashboard(habits) {
  const latestOnboardingHabitByTitle = new Map();
  const nonOnboardingHabits = [];

  for (const habit of habits ?? []) {
    const isOnboardingHabit =
      typeof habit.description === "string" &&
      habit.description.startsWith(ONBOARDING_DESCRIPTION_PREFIX);

    if (!isOnboardingHabit) {
      nonOnboardingHabits.push(habit);
      continue;
    }

    const existingHabit = latestOnboardingHabitByTitle.get(habit.title);
    const existingTime = existingHabit
      ? Date.parse(existingHabit.created_at ?? 0)
      : 0;
    const currentTime = Date.parse(habit.created_at ?? 0);

    if (!existingHabit || currentTime >= existingTime) {
      latestOnboardingHabitByTitle.set(habit.title, habit);
    }
  }

  return [...nonOnboardingHabits, ...latestOnboardingHabitByTitle.values()];
}

function buildMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getDashboardHabitIcon(title) {
  if (title === "drink_water") {
    return "water";
  }

  if (title === "walk") {
    return "run";
  }

  return "read";
}

function buildQuickAction(habit, progress) {
  const normalizedHabitType = getHabitType(habit);
  const isBadHabit = normalizedHabitType === "negative";
  const targetValue = Number(habit.target_value ?? 1);
  const targetUnit = habit.target_unit ?? "times";

  return {
    id: habit.habit_id,
    title: habit.title,
    description: habit.target_value
      ? isBadHabit
        ? `Limit: up to ${targetValue} ${targetUnit}`
        : `Target: ${targetValue} ${targetUnit}`
      : isBadHabit
        ? "Stay under your limit"
        : "Daily goal",
    targetValue,
    targetUnit,
    habitType: normalizedHabitType,
    frequencyType: habit.frequency_type ?? "daily",
    frequencyDays: toFrequencyDayKeys(habit.frequency_days ?? []),
    color: "#3B82F6",
    tintColor: "#EDF5FF",
    icon: getDashboardHabitIcon(habit.title),
    completedToday: progress?.completedToday ?? false,
    loggedToday: progress?.loggedToday ?? false,
    todayStatus: progress?.todayStatus ?? null,
    currentStreak: progress?.currentStreak ?? 0,
    bestStreak: progress?.bestStreak ?? 0,
    isScheduledToday: progress?.isScheduledToday ?? false,
    expReward: Number(habit.exp_reward ?? 0),
    streakBonusExp: Number(habit.streak_bonus_exp ?? 0),
  };
}

// GET /api/dashboard
router.get("/", requireUser, async (req, res) => {
  try {
    const userId = req.userId;
    const [habitsResult, logsResult, characterResult] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("characters")
        .select("level, current_hp, max_hp, current_exp, exp_to_next_level")
        .eq("user_id", req.userId)
        .maybeSingle(),
    ]);
    const { data: habits } = habitsResult;
    const { data: recentLogs } = logsResult;
    const { data: character } = characterResult;

    if (characterResult.error) {
      throw characterResult.error;
    }

    const normalizedHabits = normalizeHabitsForDashboard(habits);
    const progressMap = buildHabitProgressMap(normalizedHabits, recentLogs ?? []);
    const completedDateKeys = (recentLogs ?? [])
      .filter((log) => !log.status || isSuccessStatus(log.status))
      .map((log) => log.log_date);
    const { streak } = calculateGlobalStreak(completedDateKeys);
    const stats = buildStats(character, streak);
    const todayProgress = summarizeDailyProgress(normalizedHabits, progressMap);

    const dashboardHabits = normalizedHabits
      .map((habit) => {
        const progress = progressMap.get(habit.habit_id);
        return buildQuickAction(habit, progress);
      });
    const quickActions = dashboardHabits
      .sort((leftHabit, rightHabit) => {
        const leftRank =
          (leftHabit.isScheduledToday ? 0 : 2) + (leftHabit.completedToday ? 1 : 0);
        const rightRank =
          (rightHabit.isScheduledToday ? 0 : 2) + (rightHabit.completedToday ? 1 : 0);

        return leftRank - rightRank;
      });
    const goodHabits = dashboardHabits.filter((habit) => !isNegativeHabit(habit));
    const badHabits = dashboardHabits.filter((habit) => isNegativeHabit(habit));

    return res.json({
      resolvedUserId: req.userId,
      todayProgress: todayProgress.ratio,
      monthLabel: buildMonthLabel(),
      stats,
      player: buildPlayerSummary(character, streak),
      dailySummary: {
        completedCount: todayProgress.completedCount,
        totalCount: todayProgress.totalCount,
      },
      quickActions,
      calendarDays: buildWeekCalendar(normalizedHabits, recentLogs ?? []),
      goodHabits,
      badHabits,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
