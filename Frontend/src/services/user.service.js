import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";
import {
  loadCachedResource,
  setCachedResource,
} from "@/src/services/resourceCache";

const USER_PROFILE_CACHE_TTL_MS = 60_000;
const USER_STATS_CACHE_TTL_MS = 45_000;
const USER_ANALYTICS_CACHE_TTL_MS = 45_000;

function getCurrentUserCacheKey(userId) {
  return `user-profile:${userId ?? "guest"}`;
}

function getUserStatsCacheKey(userId) {
  return `user-stats:${userId ?? "guest"}`;
}

function getUserAnalyticsCacheKey(userId, period = "week") {
  return `user-analytics:${userId ?? "guest"}:${period}`;
}

async function loadUserServiceContext() {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  return {
    persistedState,
    userProfile,
  };
}

function setCurrentUserCache(userId, profile) {
  return setCachedResource(
    getCurrentUserCacheKey(userId),
    profile,
    USER_PROFILE_CACHE_TTL_MS,
  );
}

function buildFallbackProfile(name, completed, avatarUrl = null) {
  return {
    id: null,
    name: name ?? "Guest User",
    avatarUrl,
    level: completed ? 1 : 0,
    levelProgress: completed ? 20 : 0,
  };
}

function buildFallbackStats(completed) {
  return [
    {
      label: "HP",
      value: completed ? 80 : 0,
      max: 100,
      color: colors.danger,
      icon: "heart",
    },
    {
      label: "EXP",
      value: completed ? 35 : 0,
      max: 100,
      color: colors.primary,
      icon: "flash",
    },
    {
      label: "Streaks",
      value: completed ? 2 : 0,
      max: 7,
      color: colors.warning,
      icon: "flame",
    },
  ];
}

function buildFallbackAnalytics(persistedState, period = "week") {
  const profile = buildFallbackProfile(
    persistedState?.userProfile?.name,
    persistedState?.completed,
    persistedState?.userProfile?.avatarUrl ?? null,
  );
  const stats = buildFallbackStats(persistedState?.completed);

  return {
    profile,
    range: {
      period,
      days: period === "day" ? 1 : period === "year" ? 365 : period === "month" ? 30 : 7,
      startDate: null,
      endDate: null,
    },
    summary: {
      scheduledCount: 0,
      successCount: 0,
      completedCount: 0,
      missedCount: 0,
      punishedCount: 0,
      avoidedCount: 0,
      failedCount: 0,
      unverifiedCount: 0,
      totalExpGained: 0,
      totalHpChange: 0,
      completionRate: 0,
      avoidanceRate: 0,
      activeDays: 0,
      activeHabitCount: 0,
      activeGlobalStreak: stats.find((item) => item.label === "Streaks")?.value ?? 0,
      bestHabitStreak: 0,
      dueTodayCount: 0,
      completedTodayCount: 0,
      remainingTodayCount: 0,
      goodHabits: {
        scheduledCount: 0,
        completedCount: 0,
        missedCount: 0,
        punishedCount: 0,
        completionRate: 0,
        dueTodayCount: 0,
        completedTodayCount: 0,
        remainingTodayCount: 0,
      },
      badHabits: {
        scheduledCount: 0,
        avoidedCount: 0,
        failedCount: 0,
        unverifiedCount: 0,
        avoidanceRate: 0,
        dueTodayCount: 0,
        avoidedTodayCount: 0,
        unverifiedTodayCount: 0,
      },
    },
    player: {
      level: profile.level ?? 1,
      currentHp: stats.find((item) => item.label === "HP")?.value ?? 0,
      maxHp: stats.find((item) => item.label === "HP")?.max ?? 100,
      currentExp: stats.find((item) => item.label === "EXP")?.value ?? 0,
      expToNextLevel: stats.find((item) => item.label === "EXP")?.max ?? 100,
      streak: stats.find((item) => item.label === "Streaks")?.value ?? 0,
    },
    stats,
    activityHeatmap: {
      weeks: [],
      legend: [],
    },
    weekdayBreakdown: [],
    categoryBreakdown: [],
    streakHabits: [],
    recentDays: [],
    topHabits: [],
    generatedAt: new Date().toISOString(),
    source: "fallback_local_data",
  };
}

function assertResolvedUserMatches(profile, resolvedUserId, expectedUserId) {
  const backendUserId = profile?.id ?? resolvedUserId ?? null;

  if (!backendUserId || !expectedUserId) {
    return;
  }

  if (backendUserId !== expectedUserId) {
    throw new Error(
      "Your current session is linked to a different account. Please sign out and sign in again.",
    );
  }
}

export async function getCurrentUser(options = {}) {
  const { persistedState, userProfile } = await loadUserServiceContext();
  const cacheKey = getCurrentUserCacheKey(userProfile?.id);

  if (!userProfile?.id) {
    return setCachedResource(
      cacheKey,
      buildFallbackProfile(
        userProfile?.name,
        persistedState?.completed,
        userProfile?.avatarUrl ?? null,
      ),
      USER_PROFILE_CACHE_TTL_MS,
    );
  }

  return loadCachedResource(
    cacheKey,
    async () => {
      try {
        return await apiRequest("/users/me", {
          method: "GET",
          userId: userProfile.id,
          authToken: userProfile.accessToken,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn("Falling back to local profile data.", error);
        }

        return buildFallbackProfile(
          userProfile.name,
          persistedState?.completed,
          userProfile?.avatarUrl ?? null,
        );
      }
    },
    {
      ttlMs: USER_PROFILE_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function updateCurrentUserAvatar(avatarUrl) {
  const { userProfile } = await loadUserServiceContext();

  if (!userProfile?.id) {
    throw new Error("Please sign in before changing your avatar.");
  }

  const updatedProfile = await apiRequest("/users/me", {
    method: "PATCH",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: {
      avatarUrl,
    },
  });

  setCurrentUserCache(userProfile.id, updatedProfile);

  return updatedProfile;
}

export async function uploadCurrentUserAvatar({ contentType, imageBase64 }) {
  const { userProfile } = await loadUserServiceContext();

  if (!userProfile?.id) {
    throw new Error("Please sign in before uploading an avatar.");
  }

  const updatedProfile = await apiRequest("/users/me/avatar-upload", {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs: 30000,
    body: {
      contentType,
      imageBase64,
    },
  });

  setCurrentUserCache(userProfile.id, updatedProfile);

  return updatedProfile;
}

export async function getUserStats(options = {}) {
  const { persistedState, userProfile } = await loadUserServiceContext();
  const cacheKey = getUserStatsCacheKey(userProfile?.id);

  if (!userProfile?.id) {
    return setCachedResource(
      cacheKey,
      buildFallbackStats(persistedState?.completed),
      USER_STATS_CACHE_TTL_MS,
    );
  }

  return loadCachedResource(
    cacheKey,
    async () => {
      try {
        return await apiRequest("/users/me/stats", {
          method: "GET",
          userId: userProfile.id,
          authToken: userProfile.accessToken,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn("Falling back to local stats data.", error);
        }

        return buildFallbackStats(persistedState?.completed);
      }
    },
    {
      ttlMs: USER_STATS_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function getUserAnalytics(options = {}) {
  const { persistedState, userProfile } = await loadUserServiceContext();
  const period =
    typeof options.period === "string" ? options.period.toLowerCase() : null;
  const normalizedPeriod =
    period === "day" || period === "week" || period === "month" || period === "year"
      ? period
      : Number.isFinite(options.days) && Number(options.days) >= 365
        ? "year"
        : Number.isFinite(options.days) && Number(options.days) >= 28
          ? "month"
          : Number.isFinite(options.days) && Number(options.days) === 1
            ? "day"
            : "week";
  const cacheKey = getUserAnalyticsCacheKey(userProfile?.id, normalizedPeriod);

  if (!userProfile?.id) {
    return setCachedResource(
      cacheKey,
      buildFallbackAnalytics(persistedState, normalizedPeriod),
      USER_ANALYTICS_CACHE_TTL_MS,
    );
  }

  return loadCachedResource(
    cacheKey,
    async () => {
      const response = await apiRequest(
        `/users/me/analytics?period=${normalizedPeriod}`,
        {
        method: "GET",
        userId: userProfile.id,
        authToken: userProfile.accessToken,
        timeoutMs: 20000,
        },
      );

      assertResolvedUserMatches(
        response?.profile,
        response?.resolvedUserId,
        userProfile.id,
      );

      return response;
    },
    {
      ttlMs: USER_ANALYTICS_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}
