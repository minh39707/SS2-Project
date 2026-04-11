const resourceCache = new Map();

function isFresh(entry, ttlMs) {
  return (
    entry &&
    "value" in entry &&
    entry.expiresAt != null &&
    entry.expiresAt > Date.now() &&
    ttlMs > 0
  );
}

export function peekCachedResource(key) {
  const entry = resourceCache.get(key);

  if (!entry || !("value" in entry)) {
    return null;
  }

  return entry.value;
}

export function setCachedResource(key, value, ttlMs = 30_000) {
  resourceCache.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : Number.POSITIVE_INFINITY,
    promise: null,
  });

  return value;
}

export function invalidateCachedResource(key) {
  resourceCache.delete(key);
}

export function invalidateCachedResources(keys) {
  for (const key of keys) {
    invalidateCachedResource(key);
  }
}

export function invalidateCachedResourcesByPrefix(prefixes) {
  const normalizedPrefixes = Array.isArray(prefixes)
    ? prefixes.filter((prefix) => typeof prefix === "string" && prefix.length > 0)
    : [];

  if (normalizedPrefixes.length === 0) {
    return;
  }

  for (const key of resourceCache.keys()) {
    if (normalizedPrefixes.some((prefix) => key.startsWith(prefix))) {
      resourceCache.delete(key);
    }
  }
}

export function clearResourceCache() {
  resourceCache.clear();
}

export async function loadCachedResource(
  key,
  loader,
  { ttlMs = 30_000, forceRefresh = false } = {},
) {
  const existingEntry = resourceCache.get(key);

  if (!forceRefresh && isFresh(existingEntry, ttlMs)) {
    return existingEntry.value;
  }

  if (!forceRefresh && existingEntry?.promise) {
    return existingEntry.promise;
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      setCachedResource(key, value, ttlMs);
      return value;
    })
    .catch((error) => {
      if (existingEntry && "value" in existingEntry) {
        resourceCache.set(key, {
          ...existingEntry,
          promise: null,
        });
      } else {
        resourceCache.delete(key);
      }

      throw error;
    });

  resourceCache.set(key, {
    value: existingEntry?.value,
    expiresAt: existingEntry?.expiresAt ?? 0,
    promise,
  });

  return promise;
}
