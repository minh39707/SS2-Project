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

function buildGetOptions(userProfile, timeoutMs = 15000) {
  return { method: "GET", userId: userProfile.id, authToken: userProfile.accessToken, timeoutMs };
}

function buildPostOptions(userProfile, body = undefined, timeoutMs = 15000) {
  return {
    method: "POST",
    userId: userProfile.id,
    authToken: userProfile.accessToken,
    timeoutMs,
    ...(body !== undefined && { body }),
  };
}

export async function getStoreItems() {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest("/store/items", buildGetOptions(userProfile));
}

export async function getStoreInventory() {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest("/store/inventory", buildGetOptions(userProfile));
}

export async function buyItem(listingId) {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest("/store/buy", buildPostOptions(userProfile, { listing_id: listingId }));
}

export async function useItem(inventoryId) {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest(`/store/use/${inventoryId}`, buildPostOptions(userProfile));
}

export async function sellItem(inventoryId) {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest(`/store/sell/${inventoryId}`, buildPostOptions(userProfile));
}

export async function equipItem(inventoryId, equip) {
  const { userProfile } = await loadStoreServiceContext();
  return apiRequest(`/store/equip/${inventoryId}`, buildPostOptions(userProfile, { equip }));
}
