const AVATAR_BUCKET_PATH = "/storage/v1/object/public/avatars/";

function isManagedAvatarUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.pathname.includes(AVATAR_BUCKET_PATH);
  } catch {
    return false;
  }
}

function normalizeVersionValue(versionSource) {
  if (!versionSource) {
    return null;
  }

  const timestamp = Date.parse(versionSource);

  if (Number.isNaN(timestamp)) {
    return String(versionSource);
  }

  return String(timestamp);
}

function buildVersionedAvatarUrl(avatarUrl, versionSource) {
  if (typeof avatarUrl !== "string") {
    return avatarUrl ?? null;
  }

  const trimmedValue = avatarUrl.trim();

  if (!trimmedValue || !isManagedAvatarUrl(trimmedValue)) {
    return trimmedValue || null;
  }

  const versionValue = normalizeVersionValue(versionSource);

  if (!versionValue) {
    return trimmedValue;
  }

  const parsedUrl = new URL(trimmedValue);
  parsedUrl.searchParams.set("v", versionValue);

  return parsedUrl.toString();
}

module.exports = {
  buildVersionedAvatarUrl,
};
