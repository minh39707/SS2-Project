const express = require('express');
const { supabase } = require('../supabase');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_UPLOAD_BYTES = 3 * 1024 * 1024;
let hasEnsuredAvatarBucket = false;

function serializeUserProfile(user, character) {
  const level = character?.level ?? 1;
  const exp = character?.current_exp ?? 0;
  const nextExp = character?.exp_to_next_level ?? 100;
  const levelProgress = nextExp > 0 ? Math.floor((exp / nextExp) * 100) : 0;

  return {
    id: user.user_id,
    name: user.username,
    avatarUrl: user.avatar_url ?? null,
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
        .select('user_id, username, avatar_url, created_at')
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
      .select('user_id, username, avatar_url, created_at')
      .single();

    if (error || !updatedUser) {
      return res.status(400).json({ message: error?.message ?? 'Unable to update profile.' });
    }

    return res.json(
      serializeUserProfile(updatedUser, await loadCharacterProgress(req.userId)),
    );
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
      .select('user_id, username, avatar_url, created_at')
      .single();

    if (error || !updatedUser) {
      return res.status(400).json({
        message: error?.message ?? 'Unable to save uploaded avatar.',
      });
    }

    return res.json(
      serializeUserProfile(updatedUser, await loadCharacterProgress(req.userId)),
    );
  } catch (err) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/users/me/stats
router.get('/me/stats', requireUser, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [characterResult, logsResult] = await Promise.all([
      supabase
        .from('characters')
        .select('current_hp, max_hp, current_exp')
        .eq('user_id', req.userId)
        .single(),
      supabase
        .from('habit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .gte('log_date', sevenDaysAgo.toISOString().split('T')[0]),
    ]);
    const { data: character } = characterResult;
    const { count: weekLogs } = logsResult;

    const hp = character?.current_hp ?? 100;
    const maxHp = character?.max_hp ?? 100;
    // Scale EXP to 100-max for frontend progress bar
    const exp = character?.current_exp ?? 0;
    const streak = weekLogs ?? 0;

    return res.json([
      { label: 'HP', value: hp, max: maxHp, color: '#EF4444', icon: 'heart' },
      { label: 'EXP', value: exp % 100, max: 100, color: '#3B82F6', icon: 'flash' }, // Using modulo 100 to show bar progress
      { label: 'Streaks', value: streak, max: 7, color: '#F59E0B', icon: 'flame' },
    ]);
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
