import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";
import {
  loadCachedResource,
  setCachedResource,
} from "@/src/services/resourceCache";

const USER_PROFILE_CACHE_TTL_MS = 60_000;
const USER_STATS_CACHE_TTL_MS = 45_000;

function getCurrentUserCacheKey(userId) {
  return `user-profile:${userId ?? "guest"}`;
}

function getUserStatsCacheKey(userId) {
  return `user-stats:${userId ?? "guest"}`;
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

export async function getCurrentUser(options = {}) {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;
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
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

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

  setCachedResource(
    getCurrentUserCacheKey(userProfile.id),
    updatedProfile,
    USER_PROFILE_CACHE_TTL_MS,
  );

  return updatedProfile;
}

export async function uploadCurrentUserAvatar({ contentType, imageBase64 }) {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

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

  setCachedResource(
    getCurrentUserCacheKey(userProfile.id),
    updatedProfile,
    USER_PROFILE_CACHE_TTL_MS,
  );

  return updatedProfile;
}

export async function getUserStats(options = {}) {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;
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
