import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const FALLBACK_REQUEST_TIMEOUT_MS = 4000;
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredApiHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
const configuredApiPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || "4000";
const configuredApiScheme =
  process.env.EXPO_PUBLIC_API_SCHEME?.trim() || "http";

export async function simulateRequest(payload, delay = 180) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return payload;
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

class ApiConnectivityError extends Error {
  constructor(message, cause, baseUrl) {
    super(message);
    this.name = "ApiConnectivityError";
    this.cause = cause;
    this.baseUrl = baseUrl;
  }
}

function getExpoHost() {
  const expoConfig = Constants.expoConfig;
  const hostUri = expoConfig?.hostUri;
  const debuggerHost =
    expoConfig?.extra?.expoGo?.debuggerHost ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    Constants.manifest?.debuggerHost;
  const candidate = hostUri ?? debuggerHost;

  if (!candidate) {
    return null;
  }

  return candidate.split(":")[0] ?? null;
}

function buildApiBaseUrl(host) {
  return `${configuredApiScheme}://${host}:${configuredApiPort}/api`;
}

function dedupeBaseUrls(baseUrls) {
  return [...new Set(baseUrls.filter(Boolean))];
}

function getFallbackApiBaseUrl() {
  return Platform.OS === "android"
    ? buildApiBaseUrl("10.0.2.2")
    : buildApiBaseUrl("localhost");
}

function getApiBaseUrls(apiBaseUrl) {
  if (apiBaseUrl) {
    return dedupeBaseUrls([apiBaseUrl.replace(/\/+$/, "")]);
  }

  if (configuredApiUrl) {
    return dedupeBaseUrls([configuredApiUrl.replace(/\/+$/, "")]);
  }

  const expoHost = getExpoHost();

  return dedupeBaseUrls([
    configuredApiHost ? buildApiBaseUrl(configuredApiHost) : null,
    expoHost ? buildApiBaseUrl(expoHost) : null,
    getFallbackApiBaseUrl(),
  ]);
}

export function getApiBaseUrl() {
  return getApiBaseUrls()[0] ?? getFallbackApiBaseUrl();
}

function buildHeaders(headers, hasBody, userId, authToken) {
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (hasBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (userId) {
    requestHeaders.set("x-user-id", userId);
  }

  if (authToken && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  return requestHeaders;
}

function parseResponseBody(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function performRequest(
  baseUrl,
  normalizedPath,
  {
    body,
    headers,
    userId,
    authToken,
    timeoutMs,
    ...requestInit
  },
) {
  const url = `${baseUrl}${normalizedPath}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;

  try {
    response = await fetch(url, {
      ...requestInit,
      headers: buildHeaders(headers, body !== undefined, userId, authToken),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiConnectivityError(
        `Request to ${normalizedPath} timed out after ${timeoutMs}ms.`,
        error,
        baseUrl,
      );
    }

    throw new ApiConnectivityError(
      `Unable to reach backend at ${baseUrl}. Set EXPO_PUBLIC_API_URL if needed.`,
      error,
      baseUrl,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  const parsedBody = parseResponseBody(rawBody);

  if (!response.ok) {
    const message =
      typeof parsedBody === "object" &&
      parsedBody &&
      "message" in parsedBody &&
      typeof parsedBody.message === "string"
        ? parsedBody.message
        : `Request failed with status ${response.status}.`;

    throw new ApiError(response.status, message, parsedBody);
  }

  return parsedBody;
}

export async function apiRequest(path, options = {}) {
  const {
    apiBaseUrl,
    body,
    headers,
    userId,
    authToken,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ...requestInit
  } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const baseUrls = getApiBaseUrls(apiBaseUrl);
  const shouldRetryWithFallback =
    !apiBaseUrl && !configuredApiUrl && (method === "GET" || method === "HEAD");

  let lastError = null;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const attemptTimeoutMs =
      index === 0 || !shouldRetryWithFallback
        ? timeoutMs
        : Math.min(timeoutMs, FALLBACK_REQUEST_TIMEOUT_MS);

    try {
      return await performRequest(baseUrl, normalizedPath, {
        ...requestInit,
        body,
        headers,
        userId,
        authToken,
        timeoutMs: attemptTimeoutMs,
      });
    } catch (error) {
      if (!(error instanceof ApiConnectivityError)) {
        throw error;
      }

      lastError = error;

      if (!shouldRetryWithFallback || index === baseUrls.length - 1) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Unable to complete API request.");
}
