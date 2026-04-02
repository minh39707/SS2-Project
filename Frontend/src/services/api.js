import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
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

export function getApiBaseUrl() {
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, "");
  }

  if (configuredApiHost) {
    return buildApiBaseUrl(configuredApiHost);
  }

  const expoHost = getExpoHost();

  if (expoHost) {
    return buildApiBaseUrl(expoHost);
  }

  return Platform.OS === "android"
    ? buildApiBaseUrl("10.0.2.2")
    : buildApiBaseUrl("localhost");
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
  const resolvedBaseUrl = apiBaseUrl
    ? apiBaseUrl.replace(/\/+$/, "")
    : getApiBaseUrl();
  const url = `${resolvedBaseUrl}${normalizedPath}`;

  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(url, {
      ...requestInit,
      headers: buildHeaders(headers, body !== undefined, userId, authToken),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request to ${normalizedPath} timed out after ${timeoutMs}ms.`,
      );
    }

    throw new Error(
      `Unable to reach backend at ${resolvedBaseUrl}. Set EXPO_PUBLIC_API_URL if needed.`,
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
