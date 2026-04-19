import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "@/src/services/api";
import { supabase } from "@/src/services/supabase";

WebBrowser.maybeCompleteAuthSession();

const OAUTH_CALLBACK_PATH = "auth-callback";
const REDIRECT_PROTOCOLS_WITH_NETWORK_HOST = new Set([
  "http:",
  "https:",
  "exp:",
  "exps:",
]);
const INVALID_REFRESH_TOKEN_MESSAGES = [
  "Invalid Refresh Token",
  "Refresh Token Not Found",
];

function getSearchParams(urlPart = "") {
  const normalizedValue =
    urlPart.startsWith("?") || urlPart.startsWith("#")
      ? urlPart.slice(1)
      : urlPart;
  return new URLSearchParams(normalizedValue);
}

function buildApiBaseUrlForHost(hostname) {
  return `http://${hostname}:4000/api`;
}

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

function getApiBaseUrlFromRedirect(redirectUrl) {
  try {
    const parsedUrl = new URL(redirectUrl);

    if (!REDIRECT_PROTOCOLS_WITH_NETWORK_HOST.has(parsedUrl.protocol)) {
      return null;
    }

    const hostname = parsedUrl.hostname;

    if (!hostname) {
      return null;
    }

    return buildApiBaseUrlForHost(hostname);
  } catch {
    return null;
  }
}

function buildProfile(user, session, fallbackProfile = {}) {
  const authMethod =
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? "oauth";
  const providerAvatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    user.user_metadata?.photo_url ??
    null;

  return {
    id: user.id,
    email: user.email ?? null,
    name:
      fallbackProfile.name ??
      user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "Player",
    avatarUrl:
      fallbackProfile.avatarUrl ??
      providerAvatarUrl ??
      null,
    providerAvatarUrl,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    authMethod,
  };
}

function isInvalidRefreshTokenError(error) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return INVALID_REFRESH_TOKEN_MESSAGES.some((token) =>
    message.includes(token),
  );
}

async function safelyClearSupabaseSession() {
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error && !isInvalidRefreshTokenError(error)) {
    throw new Error(error.message);
  }
}

async function finalizeOAuthSession(redirectUrl) {
  const parsedUrl = new URL(redirectUrl);
  const searchParams = getSearchParams(parsedUrl.search);
  const hashParams = getSearchParams(parsedUrl.hash);

  const errorDescription =
    searchParams.get("error_description") ??
    hashParams.get("error_description");

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken =
    hashParams.get("access_token") ?? searchParams.get("access_token");
  const refreshToken =
    hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
  const authCode = searchParams.get("code") ?? hashParams.get("code");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  throw new Error("Authentication completed but no session data was returned.");
}

async function syncOAuthProfile(provider, apiBaseUrlOverride = null) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token || !session.user) {
    throw new Error("Unable to create a Supabase session for this login.");
  }

  const resolvedProvider =
    provider ??
    session.user.app_metadata?.provider ??
    session.user.identities?.[0]?.provider ??
    "oauth";

  const response = await apiRequest("/auth/oauth-sync", {
    apiBaseUrl: apiBaseUrlOverride,
    method: "POST",
    authToken: session.access_token,
    timeoutMs: 20000,
    body: {
      provider: resolvedProvider,
    },
  });

  return buildProfile(session.user, session, {
    name: response?.user?.name,
    avatarUrl: response?.user?.avatarUrl,
  });
}

export function getOAuthRedirectUrl() {
  return AuthSession.makeRedirectUri({
    path: OAUTH_CALLBACK_PATH,
    scheme: "project",
  });
}

export async function signInWithOAuth(provider) {
  const redirectTo = getOAuthRedirectUrl();
  const queryParams =
    provider === "google" || provider === "github"
      ? {
          prompt: "select_account",
        }
      : undefined;

  // Clear the app's local auth state before starting a new OAuth flow.
  // This helps avoid reusing a previous Supabase session when switching accounts.
  await safelyClearSupabaseSession();

  if (__DEV__) {
    console.log(`[oauth:${provider}] redirectTo`, redirectTo);
    console.log(
      `[oauth:${provider}] runtime`,
      isExpoGo() ? "expo-go" : "native-build",
    );

    if (isExpoGo()) {
      console.log(
        `[oauth:${provider}] Add this exact exp:// URL to Supabase Redirect URLs for Expo Go local auth.`,
      );
    }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === "facebook" ? "email public_profile" : undefined,
      queryParams,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.url) {
    throw new Error(`Supabase did not return an OAuth URL for ${provider}.`);
  }

  if (__DEV__) {
    console.log(`[oauth:${provider}] authorizeUrl`, data.url);
  }

  let result;

  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      // Best effort account isolation on iOS. This requests a private auth
      // session so OAuth providers don't reuse the browser's normal cookies.
      // Android custom tabs may still reuse the browser's existing cookies.
      preferEphemeralSession: Platform.OS === "ios",
    });
  } catch (error) {
    if (isExpoGo()) {
      throw new Error(
        `Google sign-in could not return to Expo Go. Add this exact URL to Supabase Redirect URLs and try again: ${redirectTo}`,
      );
    }

    throw error;
  }

  if (result.type !== "success" || !result.url) {
    if (isExpoGo()) {
      throw new Error(
        `Google sign-in did not complete. In Supabase Auth > URL Configuration, add this exact Redirect URL: ${redirectTo}`,
      );
    }

    throw new Error("Sign in was canceled before it completed.");
  }

  await finalizeOAuthSession(result.url);

  return syncOAuthProfile(provider, getApiBaseUrlFromRedirect(result.url));
}

export async function completeOAuthSignInFromRedirect(redirectUrl) {
  await finalizeOAuthSession(redirectUrl);
  return syncOAuthProfile(null, getApiBaseUrlFromRedirect(redirectUrl));
}

export async function signOutFromSupabase() {
  await safelyClearSupabaseSession();
}
