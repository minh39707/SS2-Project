import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const FALLBACK_REQUEST_TIMEOUT_MS = 4000;
const HEALTHCHECK_TIMEOUT_MS = 1800;
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredApiHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
const configuredApiPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || "4000";
const configuredApiScheme =
  process.env.EXPO_PUBLIC_API_SCHEME?.trim() || "http";
let preferredApiBaseUrl = null;
let resolvingApiBaseUrlPromise = null;

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

function normalizeBaseUrl(baseUrl) {
  return baseUrl?.replace(/\/+$/, "") ?? null;
}

function getFallbackApiBaseUrls() {
  if (Platform.OS === "android") {
    return dedupeBaseUrls([
      buildApiBaseUrl("10.0.2.2"),
      buildApiBaseUrl("10.0.3.2"),
    ]);
  }

  return dedupeBaseUrls([buildApiBaseUrl("localhost")]);
}

function getApiBaseUrls(apiBaseUrl) {
  if (apiBaseUrl) {
    return dedupeBaseUrls([normalizeBaseUrl(apiBaseUrl)]);
  }

  const expoHost = getExpoHost();

  return dedupeBaseUrls([
    configuredApiUrl ? normalizeBaseUrl(configuredApiUrl) : null,
    configuredApiHost ? buildApiBaseUrl(configuredApiHost) : null,
    expoHost ? buildApiBaseUrl(expoHost) : null,
    ...getFallbackApiBaseUrls(),
  ]);
}

export function getApiBaseUrl() {
  return preferredApiBaseUrl ?? getApiBaseUrls()[0] ?? getFallbackApiBaseUrls()[0];
}

function getOrderedCandidateBaseUrls(baseUrlHint = null) {
  return dedupeBaseUrls([
    normalizeBaseUrl(baseUrlHint),
    preferredApiBaseUrl,
    ...getApiBaseUrls(),
  ]);
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

async function probeApiBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizedBaseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveApiBaseUrl(forceRefresh = false) {
  const candidates = getOrderedCandidateBaseUrls();

  if (!forceRefresh && preferredApiBaseUrl && candidates.includes(preferredApiBaseUrl)) {
    return preferredApiBaseUrl;
  }

  if (!forceRefresh && resolvingApiBaseUrlPromise) {
    return resolvingApiBaseUrlPromise;
  }

  resolvingApiBaseUrlPromise = (async () => {
    for (const baseUrl of candidates) {
      if (await probeApiBaseUrl(baseUrl)) {
        preferredApiBaseUrl = baseUrl;
        return baseUrl;
      }
    }

    preferredApiBaseUrl = candidates[0] ?? getFallbackApiBaseUrls()[0];
    return preferredApiBaseUrl;
  })();

  try {
    return await resolvingApiBaseUrlPromise;
  } finally {
    resolvingApiBaseUrlPromise = null;
  }
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
  const explicitBaseUrl = normalizeBaseUrl(apiBaseUrl);
  const resolvedBaseUrl = explicitBaseUrl ?? (await resolveApiBaseUrl());
  const baseUrls = explicitBaseUrl
    ? [explicitBaseUrl]
    : getOrderedCandidateBaseUrls(resolvedBaseUrl);

  let lastError = null;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const attemptTimeoutMs =
      index === 0
        ? timeoutMs
        : Math.min(timeoutMs, FALLBACK_REQUEST_TIMEOUT_MS);

    try {
      const response = await performRequest(baseUrl, normalizedPath, {
        ...requestInit,
        body,
        headers,
        userId,
        authToken,
        timeoutMs: attemptTimeoutMs,
      });

      if (!explicitBaseUrl) {
        preferredApiBaseUrl = baseUrl;
      }

      return response;
    } catch (error) {
      if (!(error instanceof ApiConnectivityError)) {
        throw error;
      }

      lastError = error;

      if (!explicitBaseUrl && preferredApiBaseUrl === baseUrl) {
        preferredApiBaseUrl = null;
      }

      if (
        explicitBaseUrl ||
        error.cause?.name === "AbortError" ||
        index === baseUrls.length - 1
      ) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Unable to complete API request.");
}
