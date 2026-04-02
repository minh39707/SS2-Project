const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const { toFrequencyDayKeys } = require("../utils/frequencyDays");

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

function buildCalendarDays(habits, logs) {
  const dayLabels = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const shortLabels = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  // Build a set of dates that have completed logs
  const completedDates = new Set(
    logs.map((log) => new Date(log.log_date).toDateString()),
  );

  return dayLabels.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isSelected = date.toDateString() === now.toDateString();
    const isDone = completedDates.has(date.toDateString());

    return {
      label: shortLabels[day],
      date: date.getDate(),
      status: isDone ? "done" : isSelected ? "warning" : "empty",
      isSelected,
    };
  });
}

// GET /api/dashboard
router.get("/", requireUser, async (req, res) => {
  try {
    const userId = req.userId;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const [habitsResult, logsResult, characterResult] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", sevenDaysAgo.toISOString().split("T")[0]),
      supabase
        .from("characters")
        .select("current_hp, max_hp, current_exp")
        .eq("user_id", req.userId)
        .single(),
    ]);
    const { data: habits } = habitsResult;
    const { data: recentLogs } = logsResult;
    const { data: character } = characterResult;

    const normalizedHabits = normalizeHabitsForDashboard(habits);
    const weekLogs = recentLogs?.length ?? 0;
    const hp = character?.current_hp ?? 100;
    const maxHp = character?.max_hp ?? 100;
    const exp = character?.current_exp ?? 0;
    const streak = weekLogs;

    const stats = [
      { label: "HP", value: hp, max: maxHp, color: "#EF4444", icon: "heart" },
      {
        label: "EXP",
        value: exp % 100,
        max: 100,
        color: "#3B82F6",
        icon: "flash",
      },
      {
        label: "Streaks",
        value: streak,
        max: 7,
        color: "#F59E0B",
        icon: "flame",
      },
    ];

    // Quick actions from habits
    const quickActions = normalizedHabits.map((habit) => ({
      id: habit.habit_id,
      title: habit.title,
      description: habit.target_value
        ? `Target: ${habit.target_value} ${habit.target_unit ?? "times"}`
        : "Daily goal",
      frequencyType: habit.frequency_type ?? "daily",
      frequencyDays: toFrequencyDayKeys(habit.frequency_days ?? []),
      color: "#3B82F6",
      tintColor: "#EDF5FF",
      icon:
        habit.title === "drink_water"
          ? "water"
          : habit.title === "walk"
            ? "run"
            : "read",
    }));

    // Good habits list
    const goodHabits = normalizedHabits.map((habit) => ({
      id: habit.habit_id,
      title: habit.title,
      progressLabel: habit.frequency_type ?? "daily",
      actionLabel: "Ready today",
      icon: "book",
      iconColor: "#3B82F6",
      iconBackground: "#EEF5FF",
      actionTone: "primary",
    }));

    const todayProgress =
      normalizedHabits.length > 0 ? Math.min(1, weekLogs / 7) : 0;

    return res.json({
      todayProgress,
      monthLabel: buildMonthLabel(),
      stats,
      quickActions,
      calendarDays: buildCalendarDays(normalizedHabits, recentLogs ?? []),
      goodHabits,
      badHabits: [],
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
