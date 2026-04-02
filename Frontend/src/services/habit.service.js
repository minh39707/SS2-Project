import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";
import { getHabitDisplayName } from "@/src/utils/onboarding";

function buildMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function buildFallbackStats() {
  return [
    { label: "HP", value: 0, max: 100, color: colors.danger, icon: "heart" },
    { label: "EXP", value: 0, max: 100, color: colors.primary, icon: "flash" },
    {
      label: "Streaks",
      value: 0,
      max: 7,
      color: colors.warning,
      icon: "flame",
    },
  ];
}

function toDashboardIcon(habitName) {
  if (habitName === "drink_water") {
    return "water";
  }

  if (habitName === "walk") {
    return "run";
  }

  return "read";
}

function buildCalendarDays(data) {
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

  return dayLabels.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isSelected = date.toDateString() === now.toDateString();

    return {
      label: shortLabels[day],
      date: date.getDate(),
      status: data?.habit_name
        ? isSelected
          ? "warning"
          : date < now
            ? "done"
            : "empty"
        : "empty",
      isSelected,
    };
  });
}

function buildFallbackDashboard(data) {
  const habitLabel = data
    ? getHabitDisplayName(data.habit_name, data.habit_type)
    : "Your first habit";
  const stats = buildFallbackStats();

  return {
    todayProgress: 0,
    monthLabel: buildMonthLabel(),
    stats,
    quickActions: data
      ? [
          {
            id: "primary",
            title: habitLabel,
            description: `At ${data.time_exact}`,
            color: colors.primary,
            tintColor: "#EDF5FF",
            icon: toDashboardIcon(data.habit_name),
          },
        ]
      : [],
    calendarDays: buildCalendarDays(data),
    goodHabits: [],
    badHabits: [],
  };
}

export async function getDashboardData() {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    return buildFallbackDashboard(persistedState?.data ?? null);
  }

  try {
    return await apiRequest("/dashboard", {
      method: "GET",
      userId: userProfile.id,
      authToken: userProfile.accessToken,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn("Falling back to local dashboard data.", error);
    }

    return buildFallbackDashboard(persistedState?.data ?? null);
  }
}

export async function createHabit(payload, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = profileOverride ?? persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before creating a new habit.");
  }

  return apiRequest("/habits", {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: payload,
  });
}

function getAuthenticatedProfile(persistedState, profileOverride) {
  const userProfile = profileOverride ?? persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before managing habits.");
  }

  return userProfile;
}

export async function listHabits(profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);

  return apiRequest("/habits", {
    method: "GET",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });
}

export async function getHabitById(habitId, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);

  return apiRequest(`/habits/${habitId}`, {
    method: "GET",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });
}

export async function updateHabit(habitId, payload, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);

  return apiRequest(`/habits/${habitId}`, {
    method: "PATCH",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: payload,
  });
}

export async function deleteHabit(habitId, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);

  return apiRequest(`/habits/${habitId}`, {
    method: "DELETE",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });
}
