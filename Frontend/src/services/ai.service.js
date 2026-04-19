import { apiRequest } from "@/src/services/api";
import { loadOnboardingState, peekOnboardingState } from "@/src/services/onboardingStorage";
import { invalidateHabitCaches } from "@/src/services/habit.service";

async function loadAiServiceContext() {
  const persistedState = peekOnboardingState() ?? (await loadOnboardingState());
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before using AI features.");
  }

  return {
    userProfile,
  };
}

function buildAuthenticatedRequestOptions(userProfile, body, timeoutMs = 20000) {
  return {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs,
    body,
  };
}

function normalizeChatResponse(response) {
  return {
    mode: response?.mode === "habit_checkin" ? "habit_checkin" : "support_chat",
    intent: typeof response?.intent === "string" ? response.intent : null,
    reply:
      typeof response?.reply === "string" && response.reply.trim()
        ? response.reply.trim()
        : "Minh chua phan hoi duoc ro rang, ban thu noi cu the hon nhe.",
    actions: Array.isArray(response?.actions) ? response.actions : [],
    clarification_needed: response?.clarification_needed === true,
    clarification_question:
      typeof response?.clarification_question === "string" &&
      response.clarification_question.trim()
        ? response.clarification_question.trim()
        : null,
    meta: response?.meta ?? null,
  };
}

export async function sendAiChatMessage(message, options = {}) {
  const { userProfile } = await loadAiServiceContext();
  const response = await apiRequest(
    "/ai/chat",
    buildAuthenticatedRequestOptions(
      userProfile,
      {
        message,
        conversationId:
          typeof options.conversationId === "string" && options.conversationId.trim()
            ? options.conversationId.trim()
            : undefined,
      },
      25000,
    ),
  );

  const normalizedResponse = normalizeChatResponse(response);

  if (
    normalizedResponse.mode === "habit_checkin" &&
    !normalizedResponse.clarification_needed &&
    normalizedResponse.actions.length > 0
  ) {
    invalidateHabitCaches(userProfile.id);
  }

  return normalizedResponse;
}

export async function generateQuestDraft(profileOverride = null) {
  const { userProfile: persistedProfile } = await loadAiServiceContext();
  const userProfile = profileOverride ?? persistedProfile;

  return apiRequest(
    "/ai/quest/generate",
    buildAuthenticatedRequestOptions(
      userProfile,
      {
        userId: userProfile.id,
      },
      25000,
    ),
  );
}

export async function generateAnalyticsInsight(days = 7, profileOverride = null) {
  const { userProfile: persistedProfile } = await loadAiServiceContext();
  const userProfile = profileOverride ?? persistedProfile;

  return apiRequest(
    "/ai/insight",
    buildAuthenticatedRequestOptions(
      userProfile,
      {
        userId: userProfile.id,
        days,
      },
      25000,
    ),
  );
}
