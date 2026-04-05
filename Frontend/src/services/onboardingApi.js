import { apiRequest } from "@/src/services/api";
import {
  completeOAuthSignInFromRedirect,
  signInWithOAuth,
  signOutFromSupabase,
} from "@/src/services/supabaseAuth";

function signInWithProvider(provider) {
  return signInWithOAuth(provider);
}

export async function saveHabitToServer(userId, data, authToken) {
  return apiRequest("/onboarding/sync", {
    method: "POST",
    userId,
    authToken,
    body: data,
  });
}

export async function signInWithGoogle() {
  return signInWithProvider("google");
}

export async function signInWithFacebook() {
  return signInWithProvider("facebook");
}

export async function signInWithGitHub() {
  return signInWithProvider("github");
}

export async function completeOAuthRedirect(redirectUrl) {
  return completeOAuthSignInFromRedirect(redirectUrl);
}

export async function signOutAccount() {
  return signOutFromSupabase();
}

export async function signInWithEmail(payload) {
  const response = await apiRequest("/auth/email/sign-in", {
    method: "POST",
    body: payload,
  });

  return {
    ...response.user,
    accessToken: response.token ?? null,
    refreshToken: response.refresh_token ?? null,
  };
}

export async function signUpWithEmail(payload) {
  await apiRequest("/auth/email/sign-up", {
    method: "POST",
    body: payload,
  });

  return signInWithEmail({
    email: payload.email,
    password: payload.password,
  });
}
