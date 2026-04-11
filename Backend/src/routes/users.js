const express = require('express');
const { supabase } = require('../supabase');
const { requireUser } = require('../middleware/auth');
const { buildStats, calculateGlobalStreak } = require('../utils/habitProgress');
const { buildUserAnalyticsPayload } = require('../utils/userAnalytics');
const { buildVersionedAvatarUrl } = require('../utils/avatarUrl');
const { isSuccessStatus } = require('../utils/habitStatus');

const router = express.Router();
const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_UPLOAD_BYTES = 3 * 1024 * 1024;
let hasEnsuredAvatarBucket = false;

function serializeUserProfile(user, character) {
  const level = character?.level ?? 1;
  const exp = character?.current_exp ?? 0;
  const nextExp = character?.exp_to_next_level ?? 100;
  const levelProgress = nextExp > 0 ? Math.floor((exp / nextExp) * 100) : 0;
  const avatarVersion = user.updated_at ?? user.created_at ?? null;

  return {
    id: user.user_id,
    name: user.username,
    avatarUrl: buildVersionedAvatarUrl(user.avatar_url, avatarVersion),
    level,
    levelProgress,
  };
}

function normalizeAvatarUrl(avatarUrl) {
  if (avatarUrl == null || avatarUrl === "") {
    return null;
  }

  if (typeof avatarUrl !== "string") {
    return { error: "Avatar URL must be a string." };
  }

  const trimmedValue = avatarUrl.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > 500) {
    return { error: "Avatar URL is too long." };
  }

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { error: "Avatar URL must start with http:// or https://." };
    }
  } catch {
    return { error: "Avatar URL is invalid." };
  }

  return trimmedValue;
}

async function loadCharacterProgress(userId) {
  const { data } = await supabase
    .from('characters')
    .select('level, current_exp, exp_to_next_level')
    .eq('user_id', userId)
    .maybeSingle();

  return data;
}

async function loadAnalyticsHabits(userId) {
  const { data, error } = await supabase
    .from('habits')
    .select('habit_id, category_id, title, description, habit_type, frequency_type, frequency_days, is_active, created_at')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadAnalyticsCategoryLabels() {
  const { data, error } = await supabase
    .from('habit_categories')
    .select('category_id, name');

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((category) => [category.category_id, category.name]),
  );
}

async function loadAnalyticsLogs(userId) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, status, exp_change, hp_change')
    .eq('user_id', userId)
    .order('log_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function respondWithSerializedUser(res, userRecord, userId, statusCode = 200) {
  const profile = serializeUserProfile(
    userRecord,
    await loadCharacterProgress(userId),
  );

  return res.status(statusCode).json(profile);
}

async function ensureAvatarBucket() {
  if (hasEnsuredAvatarBucket) {
    return;
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const existingBucket = buckets?.find((bucket) => bucket.name === AVATAR_BUCKET);

  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(
      AVATAR_BUCKET,
      {
        public: true,
        fileSizeLimit: MAX_AVATAR_UPLOAD_BYTES,
      },
    );

    if (createError && createError.message !== 'Bucket already exists') {
      throw createError;
    }
  }

  hasEnsuredAvatarBucket = true;
}

function getFileExtensionFromMimeType(contentType = '') {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function decodeBase64Image(base64Value) {
  try {
    return Buffer.from(base64Value, 'base64');
  } catch {
    return null;
  }
}

// GET /api/users/me
router.get('/me', requireUser, async (req, res) => {
  try {
    const [userResult, characterResult] = await Promise.all([
      supabase
        .from('users')
        .select('user_id, username, avatar_url, created_at, updated_at')
        .eq('user_id', req.userId)
        .single(),
      supabase
        .from('characters')
        .select('level, current_exp, exp_to_next_level')
        .eq('user_id', req.userId)
        .single(),
    ]);
    const { data: user, error } = userResult;

    if (error || !user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json(serializeUserProfile(user, characterResult.data));
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// PATCH /api/users/me
router.patch('/me', requireUser, async (req, res) => {
  try {
    const normalizedAvatarUrl = normalizeAvatarUrl(req.body?.avatarUrl);

    if (
      normalizedAvatarUrl &&
      typeof normalizedAvatarUrl === "object" &&
      "error" in normalizedAvatarUrl
    ) {
      return res.status(400).json({ message: normalizedAvatarUrl.error });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        avatar_url: normalizedAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId)
      .select('user_id, username, avatar_url, created_at, updated_at')
      .single();

    if (error || !updatedUser) {
      return res.status(400).json({ message: error?.message ?? 'Unable to update profile.' });
    }

    return respondWithSerializedUser(res, updatedUser, req.userId);
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/users/me/avatar-upload
router.post('/me/avatar-upload', requireUser, async (req, res) => {
  try {
    const imageBase64 = req.body?.imageBase64;
    const contentType =
      typeof req.body?.contentType === 'string' ? req.body.contentType : 'image/jpeg';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ message: 'Avatar image is required.' });
    }

    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(contentType)) {
      return res.status(400).json({
        message: 'Avatar must be a JPG, PNG, or WEBP image.',
      });
    }

    const imageBuffer = decodeBase64Image(imageBase64);

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ message: 'Avatar image data is invalid.' });
    }

    if (imageBuffer.length > MAX_AVATAR_UPLOAD_BYTES) {
      return res.status(400).json({
        message: 'Avatar image is too large. Please choose a smaller image.',
      });
    }

    await ensureAvatarBucket();

    const fileExtension = getFileExtensionFromMimeType(contentType.toLowerCase());
    const filePath = `${req.userId}/avatar.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload avatar error:', uploadError);
      return res.status(400).json({ message: uploadError.message });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId)
      .select('user_id, username, avatar_url, created_at, updated_at')
      .single();

    if (error || !updatedUser) {
      return res.status(400).json({
        message: error?.message ?? 'Unable to save uploaded avatar.',
      });
    }

    return respondWithSerializedUser(res, updatedUser, req.userId);
  } catch (err) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/users/me/stats
router.get('/me/stats', requireUser, async (req, res) => {
  try {
    const [characterResult, logsResult] = await Promise.all([
      supabase
        .from('characters')
        .select('level, current_hp, max_hp, current_exp, exp_to_next_level')
        .eq('user_id', req.userId)
        .maybeSingle(),
      supabase
        .from('habit_logs')
        .select('log_date, status')
        .eq('user_id', req.userId),
    ]);
    const { data: character } = characterResult;
    const completedDateKeys = (logsResult.data ?? [])
      .filter((log) => isSuccessStatus(log?.status))
      .map((log) => log.log_date);
    const { streak } = calculateGlobalStreak(completedDateKeys);

    return res.json(buildStats(character, streak));
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/users/me/analytics
router.get('/me/analytics', requireUser, async (req, res) => {
  try {
    const [userResult, characterResult, habits, logs, categoryLabels] = await Promise.all([
      supabase
        .from('users')
        .select('user_id, username, avatar_url, created_at, updated_at')
        .eq('user_id', req.userId)
        .maybeSingle(),
      supabase
        .from('characters')
        .select('level, current_hp, max_hp, current_exp, exp_to_next_level')
        .eq('user_id', req.userId)
        .maybeSingle(),
      loadAnalyticsHabits(req.userId),
      loadAnalyticsLogs(req.userId),
      loadAnalyticsCategoryLabels(),
    ]);

    if (userResult.error) {
      throw userResult.error;
    }

    if (characterResult.error) {
      throw characterResult.error;
    }

    const analytics = buildUserAnalyticsPayload({
      character: characterResult.data,
      habits,
      logs,
      categoryLabels,
      days: req.query?.days,
      period: req.query?.period,
      year: req.query?.year,
    });

    return res.json({
      resolvedUserId: req.userId,
      profile: userResult.data
        ? serializeUserProfile(userResult.data, characterResult.data)
        : null,
      ...analytics,
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
