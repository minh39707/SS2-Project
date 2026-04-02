import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";

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

export async function getCurrentUser() {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    return buildFallbackProfile(
      userProfile?.name,
      persistedState?.completed,
      userProfile?.avatarUrl ?? null,
    );
  }

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
}

export async function updateCurrentUserAvatar(avatarUrl) {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before changing your avatar.");
  }

  return apiRequest("/users/me", {
    method: "PATCH",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    body: {
      avatarUrl,
    },
  });
}

export async function uploadCurrentUserAvatar({ contentType, imageBase64 }) {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before uploading an avatar.");
  }

  return apiRequest("/users/me/avatar-upload", {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs: 30000,
    body: {
      contentType,
      imageBase64,
    },
  });
}

export async function getUserStats() {
  const persistedState = await loadOnboardingState();
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    return buildFallbackStats(persistedState?.completed);
  }

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
}
