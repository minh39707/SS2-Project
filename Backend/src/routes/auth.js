const express = require("express");
const { supabase, supabaseAuth } = require("../supabase");
const { buildVersionedAvatarUrl } = require("../utils/avatarUrl");

const router = express.Router();
const DEFAULT_CHARACTER_CLASS = "Novice";
const DEFAULT_CHARACTER_STATS = {
  level: 1,
  current_hp: 100,
  max_hp: 100,
  current_exp: 0,
  exp_to_next_level: 100,
  power: 10,
  gold_coins: 0,
};

function getProviderAvatarUrl(userMetadata = {}) {
  return (
    userMetadata.avatar_url ||
    userMetadata.picture ||
    userMetadata.photo_url ||
    null
  );
}

function slugifyUsername(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

async function buildUniqueUsername(baseValue, excludeUserId = null) {
  const fallbackBase = slugifyUsername(baseValue) || "player";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate =
      attempt === 0 ? fallbackBase : `${fallbackBase}_${attempt + 1}`;
    let query = supabase
      .from("users")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();

    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  return `${fallbackBase}_${Date.now().toString().slice(-6)}`;
}

function buildUserResponse(user, profile = null, fallbackName = null) {
  const avatarVersion = profile?.updated_at ?? profile?.created_at ?? null;

  return {
    id: user.id,
    email: user.email,
    name: profile?.username ?? fallbackName ?? user.email?.split("@")[0] ?? "Player",
    avatarUrl: buildVersionedAvatarUrl(profile?.avatar_url, avatarVersion),
  };
}

function getProfileConflictMessage(error) {
  const code = error?.code ?? error?.cause?.code ?? null;
  const message = String(error?.message ?? "").toLowerCase();

  if (
    code === "23505" &&
    (message.includes("users_email_key") || message.includes(" email "))
  ) {
    return "This email is already linked to another account. Please sign in with your existing method.";
  }

  if (
    code === "23505" &&
    (message.includes("users_username_key") || message.includes(" username "))
  ) {
    return "Unable to finish sign in because this username is already taken. Please try again.";
  }

  return null;
}

function buildStarterCharacter(userId, name) {
  return {
    user_id: userId,
    name,
    class: DEFAULT_CHARACTER_CLASS,
    ...DEFAULT_CHARACTER_STATS,
  };
}

// POST /api/auth/email/sign-up
router.post("/email/sign-up", async (req, res) => {
  try {
    const { email, password, name, fullName } = req.body;
    const normalizedName = name ?? fullName;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: normalizedName ?? email.split("@")[0] },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Create profile
    const displayName = normalizedName ?? email.split("@")[0];
    await supabase.from("users").upsert({
      user_id: data.user.id,
      email: email,
      username: displayName,
    });

    // Create RPG character to initialize user level/hp
    await supabase.from("characters").insert({
      ...buildStarterCharacter(data.user.id, displayName),
    });

    return res.json({
      user: buildUserResponse(data.user, null, displayName),
    });
  } catch (err) {
    console.error("Sign-up error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// POST /api/auth/email/sign-in
router.post("/email/sign-in", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ message: error.message });
    }

    // Fetch user details for frontend payload
    const { data: profile } = await supabase
      .from("users")
      .select("username, avatar_url, created_at, updated_at")
      .eq("user_id", data.user.id)
      .single();

    return res.json({
      user: buildUserResponse(data.user, profile),
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error("Sign-in error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

const { requireUser } = require("../middleware/auth");

// POST /api/auth/oauth-sync
// This endpoint is called by the frontend after a successful OAuth login (Google/Facebook/GitHub/etc.)
// to ensure the user's profile and RPG character are initialized.
router.post("/oauth-sync", requireUser, async (req, res) => {
  try {
    const userId = req.userId;
    const userEmail = req.user?.email;
    const userMetadata = req.user?.user_metadata || {};
    const providerAvatarUrl = getProviderAvatarUrl(userMetadata);
    const displayName =
      userMetadata.name ||
      userMetadata.full_name ||
      userEmail?.split("@")[0] ||
      "Player";

    if (!userEmail) {
      return res.status(400).json({
        message:
          "OAuth provider did not return an email address. Please enable email permission or sign in with another method.",
      });
    }

    // 1. Ensure user profile exists
    let profile = null;
    let profileError = null;

    const { data: existingByUserId, error: existingByUserIdError } =
      await supabase
        .from("users")
        .select("user_id, email, username, avatar_url, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

    if (existingByUserIdError) {
      console.error(
        "OAuth sync profile lookup by user_id error:",
        existingByUserIdError,
      );
      return res.status(500).json({ message: "Failed to sync user profile." });
    }

    if (existingByUserId) {
      const nextUsername =
        existingByUserId.username ||
        (await buildUniqueUsername(displayName, userId));
      const updateResult = await supabase
        .from("users")
        .update({
          email: userEmail,
          username: nextUsername,
          avatar_url: existingByUserId.avatar_url ?? providerAvatarUrl,
        })
        .eq("user_id", userId)
        .select()
        .single();

      profile = updateResult.data;
      profileError = updateResult.error;
    } else {
      const { data: existingByEmail, error: existingByEmailError } =
        await supabase
          .from("users")
          .select("user_id, email")
          .eq("email", userEmail)
          .maybeSingle();

      if (existingByEmailError) {
        console.error(
          "OAuth sync profile lookup by email error:",
          existingByEmailError,
        );
        return res
          .status(500)
          .json({ message: "Failed to sync user profile." });
      }

      if (existingByEmail && existingByEmail.user_id !== userId) {
        return res.status(409).json({
          message:
            "This email is already linked to another account. Please sign in with your existing method.",
        });
      }

      const preferredUsername = await buildUniqueUsername(displayName, userId);

      const insertResult = await supabase
        .from("users")
        .insert({
          user_id: userId,
          email: userEmail,
          username: preferredUsername,
          avatar_url: providerAvatarUrl,
        })
        .select()
        .single();

      profile = insertResult.data;
      profileError = insertResult.error;
    }

    if (profileError) {
      console.error("OAuth sync profile error:", profileError);
      return res.status((
        getProfileConflictMessage(profileError) ? 409 : 500
      )).json({
        message:
          getProfileConflictMessage(profileError) ??
          "Failed to sync user profile.",
      });
    }

    // 2. Ensure RPG character exists
    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("character_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (charError) {
      console.error("OAuth sync character fetch error:", charError);
    }

    if (!character) {
      // Create RPG character if it doesn't exist
      const { error: insertError } = await supabase
        .from("characters")
        .insert(buildStarterCharacter(userId, displayName));

      if (insertError) {
        console.error("OAuth sync character creation error:", insertError);
        return res
          .status(500)
          .json({ message: "Failed to initialize character." });
      }
    }

    return res.json({
      message: "Sync successful",
      user: buildUserResponse(
        { id: userId, email: userEmail },
        profile,
        displayName,
      ),
    });
  } catch (err) {
    console.error("OAuth sync error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
