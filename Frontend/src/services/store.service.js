import { apiRequest } from "@/src/services/api";
import { loadOnboardingState, peekOnboardingState } from "@/src/services/onboardingStorage";

async function loadStoreServiceContext() {
  const persistedState = peekOnboardingState() ?? (await loadOnboardingState());
  const userProfile = persistedState?.userProfile ?? null;

  if (!userProfile?.id) {
    throw new Error("Please sign in before using the store.");
  }

  return { userProfile };
}

function buildAuthenticatedRequestOptions(userProfile, timeoutMs = 15000) {
  return {
    method: "GET",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs,
  };
}

export async function getStoreItems() {
  const { userProfile } = await loadStoreServiceContext();

  return apiRequest(
    "/store/items",
    buildAuthenticatedRequestOptions(userProfile),
  );
}

export async function getStoreInventory() {
  const { userProfile } = await loadStoreServiceContext();

  return apiRequest(
    "/store/inventory",
    buildAuthenticatedRequestOptions(userProfile),
  );
}
