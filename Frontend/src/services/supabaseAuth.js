import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { apiRequest } from "@/src/services/api";
import { supabase } from "@/src/services/supabase";

WebBrowser.maybeCompleteAuthSession();

const OAUTH_CALLBACK_PATH = "auth-callback";

function isExpoGo() {
  return Constants.executionEnvironment === "storeClient";
}

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

function getApiBaseUrlFromRedirect(redirectUrl) {
  try {
    const parsedUrl = new URL(redirectUrl);
    const hostname = parsedUrl.hostname;

    if (!hostname) {
      return null;
    }

    return buildApiBaseUrlForHost(hostname);
  } catch {
    return null;
  }
}

function buildProfile(user, session, fallbackName) {
  const authMethod =
    user?.app_metadata?.provider ?? user?.identities?.[0]?.provider ?? "oauth";

  return {
    id: user.id,
    email: user.email ?? null,
    name:
      fallbackName ??
      user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "Player",
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    authMethod,
  };
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

  return buildProfile(session.user, session, response?.user?.name);
}

export function getOAuthRedirectUrl() {
  return isExpoGo()
    ? Linking.createURL(OAUTH_CALLBACK_PATH, { scheme: "exp" })
    : Linking.createURL(OAUTH_CALLBACK_PATH);
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
  await supabase.auth.signOut();

  if (__DEV__) {
    console.log(`[oauth:${provider}] redirectTo`, redirectTo);
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

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    // Best effort account isolation on iOS. This requests a private auth
    // session so OAuth providers don't reuse the browser's normal cookies.
    // Android custom tabs may still reuse the browser's existing cookies.
    preferEphemeralSession: Platform.OS === "ios",
  });

  if (result.type !== "success" || !result.url) {
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
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
