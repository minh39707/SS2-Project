import { apiRequest, getApiBaseUrl } from "@/src/services/api";
import { loadOnboardingState, peekOnboardingState } from "@/src/services/onboardingStorage";

async function loadQuestServiceContext() {
  const persistedState = peekOnboardingState() ?? (await loadOnboardingState());
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before using quests.");
  }

  return { userProfile };
}

function buildGetOptions(userProfile) {
  return { method: "GET", userId: userProfile.id, authToken: userProfile.accessToken, timeoutMs: 15000 };
}

function buildPostOptions(userProfile, body = undefined) {
  return {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs: 15000,
    ...(body !== undefined && { body }),
  };
}

function buildDeleteOptions(userProfile) {
  return { method: "DELETE", userId: userProfile.id, authToken: userProfile.accessToken, timeoutMs: 15000 };
}

export async function getMyQuests() {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest("/quests/my", buildGetOptions(userProfile));
}

export async function getAvailableQuests() {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest("/quests/available", buildGetOptions(userProfile));
}

export async function generateAiQuest() {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest("/quests/ai-generate", {
    ...buildPostOptions(userProfile),
    apiBaseUrl: getApiBaseUrl(),
    timeoutMs: 190000,
  });
}

export async function acceptQuest(questId) {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest(`/quests/${questId}/accept`, buildPostOptions(userProfile));
}

export async function logQuestProgress(userQuestId) {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest(`/quests/${userQuestId}/progress`, buildPostOptions(userProfile));
}

export async function abandonQuest(userQuestId) {
  const { userProfile } = await loadQuestServiceContext();
  return apiRequest(`/quests/${userQuestId}`, buildDeleteOptions(userProfile));
}
