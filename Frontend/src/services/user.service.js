import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import {
  loadOnboardingState,
  peekOnboardingState,
} from "@/src/services/onboardingStorage";
import {
  loadCachedResource,
  setCachedResource,
} from "@/src/services/resourceCache";

const USER_PROFILE_CACHE_TTL_MS = 60_000;
const USER_STATS_CACHE_TTL_MS = 45_000;
const USER_ANALYTICS_CACHE_TTL_MS = 45_000;
const VALID_ANALYTICS_PERIODS = new Set(["day", "week", "month", "year"]);

function getCurrentCalendarYear() {
  return new Date().getFullYear();
}

function getCurrentUserCacheKey(userId) {
  return `user-profile:${userId ?? "guest"}`;
}

function getUserStatsCacheKey(userId) {
  return `user-stats:${userId ?? "guest"}`;
}

function getUserAnalyticsCacheKey(userId, period = "week", year = null) {
  if (period === "year") {
    return `user-analytics:${userId ?? "guest"}:${period}:${year ?? getCurrentCalendarYear()}`;
  }

  return `user-analytics:${userId ?? "guest"}:${period}`;
}

function getUserAnalyticsBundleCacheKey(userId, periods = [], year = null) {
  const normalizedPeriods = [...new Set(periods)]
    .filter((period) => VALID_ANALYTICS_PERIODS.has(period))
    .sort()
    .join(",");

  return `user-analytics-bundle:${userId ?? "guest"}:${normalizedPeriods}:${year ?? "current"}`;
}

function normalizeAnalyticsPeriodOption(period, days) {
  const normalizedPeriod =
    typeof period === "string" ? period.toLowerCase() : null;

  if (VALID_ANALYTICS_PERIODS.has(normalizedPeriod)) {
    return normalizedPeriod;
  }

  if (Number.isFinite(days) && Number(days) >= 365) {
    return "year";
  }

  if (Number.isFinite(days) && Number(days) >= 28) {
    return "month";
  }

  if (Number.isFinite(days) && Number(days) === 1) {
    return "day";
  }

  return "week";
}

function setUserAnalyticsCache(userId, period, analytics, year = null) {
  const cacheKey = getUserAnalyticsCacheKey(
    userId,
    period,
    period === "year" ? year : null,
  );

  setCachedResource(cacheKey, analytics, USER_ANALYTICS_CACHE_TTL_MS);
  return analytics;
}

async function loadUserServiceContext() {
  const persistedState = peekOnboardingState() ?? (await loadOnboardingState());
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
      ...(period === "year" ? { year: getCurrentCalendarYear() } : {}),
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
      selectedYear: getCurrentCalendarYear(),
      availableYears: [getCurrentCalendarYear()],
      startDate: null,
      endDate: null,
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
  const normalizedPeriod = normalizeAnalyticsPeriodOption(
    options.period,
    options.days,
  );
  const selectedYear =
    normalizedPeriod === "year"
      ? Number.parseInt(options.year, 10) || getCurrentCalendarYear()
      : null;
  const cacheKey = getUserAnalyticsCacheKey(
    userProfile?.id,
    normalizedPeriod,
    selectedYear,
  );

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
        `/users/me/analytics?period=${normalizedPeriod}${selectedYear ? `&year=${selectedYear}` : ""}`,
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

      return setUserAnalyticsCache(
        userProfile.id,
        normalizedPeriod,
        response,
        selectedYear,
      );
    },
    {
      ttlMs: USER_ANALYTICS_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}

export async function getUserAnalyticsBundle(options = {}) {
  const { persistedState, userProfile } = await loadUserServiceContext();
  const requestedPeriods = [...new Set(
    (Array.isArray(options.periods) ? options.periods : [])
      .map((period) => normalizeAnalyticsPeriodOption(period, null))
      .filter((period) => VALID_ANALYTICS_PERIODS.has(period)),
  )];
  const normalizedPeriods =
    requestedPeriods.length > 0 ? requestedPeriods : ["week"];
  const selectedYear = normalizedPeriods.includes("year")
    ? Number.parseInt(options.year, 10) || getCurrentCalendarYear()
    : null;
  const bundleCacheKey = getUserAnalyticsBundleCacheKey(
    userProfile?.id,
    normalizedPeriods,
    selectedYear,
  );

  if (!userProfile?.id) {
    const fallbackBundle = Object.fromEntries(
      normalizedPeriods.map((period) => [
        period,
        buildFallbackAnalytics(persistedState, period),
      ]),
    );

    return setCachedResource(
      bundleCacheKey,
      fallbackBundle,
      USER_ANALYTICS_CACHE_TTL_MS,
    );
  }

  return loadCachedResource(
    bundleCacheKey,
    async () => {
      const response = await apiRequest(
        `/users/me/analytics?periods=${normalizedPeriods.join(",")}${selectedYear ? `&year=${selectedYear}` : ""}`,
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

      const periodsPayload =
        response?.periods && typeof response.periods === "object"
          ? response.periods
          : {};

      return Object.fromEntries(
        normalizedPeriods.map((period) => [
          period,
          setUserAnalyticsCache(
            userProfile.id,
            period,
            periodsPayload[period] ?? buildFallbackAnalytics(persistedState, period),
            selectedYear,
          ),
        ]),
      );
    },
    {
      ttlMs: USER_ANALYTICS_CACHE_TTL_MS,
      forceRefresh: options.forceRefresh ?? false,
    },
  );
}
