import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";
import {
  invalidateCachedResources,
  loadCachedResource,
  setCachedResource,
} from "@/src/services/resourceCache";
import { getHabitDisplayName } from "@/src/utils/onboarding";

const DASHBOARD_CACHE_TTL_MS = 45_000;
const HABITS_LIST_CACHE_TTL_MS = 45_000;
const HABIT_DETAIL_CACHE_TTL_MS = 45_000;

function getDashboardCacheKey(userId) {
  return `dashboard:${userId ?? "guest"}`;
}

function getHabitsListCacheKey(userId) {
  return `habits-list:${userId}`;
}

function getHabitDetailCacheKey(userId, habitId) {
  return `habit-detail:${userId}:${habitId}`;
}

function getHabitCacheKeys(userId, habitId = null) {
  const keys = [getDashboardCacheKey(userId)];

  if (userId) {
    keys.push(getHabitsListCacheKey(userId));
    keys.push(`user-profile:${userId}`);
    keys.push(`user-stats:${userId}`);
    keys.push(`user-analytics:${userId}:7`);
    keys.push(`user-analytics:${userId}:30`);
  }

  if (userId && habitId) {
    keys.push(getHabitDetailCacheKey(userId, habitId));
  }

  return keys;
}

export function invalidateHabitCaches(userId, habitId = null) {
  invalidateCachedResources(getHabitCacheKeys(userId, habitId));
}

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

function assertResolvedUserMatches(response, expectedUserId) {
  const backendUserId = response?.resolvedUserId ?? null;

  if (!backendUserId || !expectedUserId) {
    return;
  }

  if (backendUserId !== expectedUserId) {
    throw new Error(
      "Your current session is linked to a different account. Please sign out and sign in again.",
    );
  }
}

async function resolveAuthenticatedProfile(profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = profileOverride ?? persistedState?.userProfile ?? null;

  return {
    persistedState,
    userProfile,
  };
}

function getAuthenticatedProfile(persistedState, profileOverride) {
  const userProfile = profileOverride ?? persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before managing habits.");
  }

  return userProfile;
}

export async function getDashboardData(options = {}) {
  const { persistedState, userProfile } = await resolveAuthenticatedProfile();
  const cacheKey = getDashboardCacheKey(userProfile?.id);

  if (!userProfile?.id) {
    return setCachedResource(
      cacheKey,
      buildFallbackDashboard(persistedState?.data ?? null),
      DASHBOARD_CACHE_TTL_MS,
    );
  }

  return loadCachedResource(
    cacheKey,
    async () => {
      const response = await apiRequest("/dashboard", {
        method: "GET",
        userId: userProfile.id,
        authToken: userProfile.accessToken,
        timeoutMs: 20000,
      });

      assertResolvedUserMatches(response, userProfile.id);

      return response;
    },
    {
      ttlMs: DASHBOARD_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function createHabit(payload, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = profileOverride ?? persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before creating a new habit.");
  }

  const response = await apiRequest("/habits", {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: payload,
  });

  invalidateHabitCaches(userProfile.id);
  return response;
}

export async function listHabits(profileOverride = null, options = {}) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const cacheKey = getHabitsListCacheKey(userProfile.id);

  return loadCachedResource(
    cacheKey,
    () =>
      apiRequest("/habits", {
        method: "GET",
        userId: userProfile.id,
        authToken: userProfile.accessToken,
      }),
    {
      ttlMs: HABITS_LIST_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function getHabitById(habitId, profileOverride = null, options = {}) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const cacheKey = getHabitDetailCacheKey(userProfile.id, habitId);

  return loadCachedResource(
    cacheKey,
    () =>
      apiRequest(`/habits/${habitId}`, {
        method: "GET",
        userId: userProfile.id,
        authToken: userProfile.accessToken,
      }),
    {
      ttlMs: HABIT_DETAIL_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function updateHabit(habitId, payload, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const response = await apiRequest(`/habits/${habitId}`, {
    method: "PATCH",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: payload,
  });

  invalidateHabitCaches(userProfile.id, habitId);
  return response;
}

export async function deleteHabit(habitId, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const response = await apiRequest(`/habits/${habitId}`, {
    method: "DELETE",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });

  invalidateHabitCaches(userProfile.id, habitId);
  return response;
}

export async function completeHabit(habitId, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const response = await apiRequest(`/habits/${habitId}/complete`, {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });

  invalidateHabitCaches(userProfile.id, habitId);
  return response;
}

export async function uncompleteHabit(habitId, profileOverride = null) {
  const persistedState = await loadOnboardingState();
  const userProfile = getAuthenticatedProfile(persistedState, profileOverride);
  const response = await apiRequest(`/habits/${habitId}/complete`, {
    method: "DELETE",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
  });

  invalidateHabitCaches(userProfile.id, habitId);
  return response;
}
