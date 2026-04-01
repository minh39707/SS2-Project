import { colors } from "@/src/constants/colors";
import { apiRequest } from "@/src/services/api";
import { loadOnboardingState } from "@/src/services/onboardingStorage";

function buildFallbackProfile(name, completed) {
  return {
    name: name ?? "Guest User",
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
    return buildFallbackProfile(userProfile?.name, persistedState?.completed);
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

    return buildFallbackProfile(userProfile.name, persistedState?.completed);
  }
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
