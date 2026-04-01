const express = require("express");
const { supabase } = require("../supabase");

const router = express.Router();

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
      user_id: data.user.id,
      name: displayName,
      class: "Novice",
      level: 1,
      current_hp: 100,
      max_hp: 100,
      current_exp: 0,
      exp_to_next_level: 100,
      power: 10,
      gold_coins: 0,
    });

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: displayName,
      },
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ message: error.message });
    }

    // Fetch user details for frontend payload
    const { data: profile } = await supabase
      .from("users")
      .select("username")
      .eq("user_id", data.user.id)
      .single();

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.username ?? email.split("@")[0],
      },
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
    const displayName =
      userMetadata.name ||
      userMetadata.full_name ||
      userEmail?.split("@")[0] ||
      "Player";
    const preferredUsername = await buildUniqueUsername(displayName, userId);

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
        .select("user_id, email, username")
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
      const updateResult = await supabase
        .from("users")
        .update({
          email: userEmail,
          username: preferredUsername,
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

      const insertResult = await supabase
        .from("users")
        .insert({
          user_id: userId,
          email: userEmail,
          username: preferredUsername,
        })
        .select()
        .single();

      profile = insertResult.data;
      profileError = insertResult.error;
    }

    if (profileError) {
      console.error("OAuth sync profile error:", profileError);
      return res.status(500).json({ message: "Failed to sync user profile." });
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
      const { error: insertError } = await supabase.from("characters").insert({
        user_id: userId,
        name: displayName,
        class: "Novice",
        level: 1,
        current_hp: 100,
        max_hp: 100,
        current_exp: 0,
        exp_to_next_level: 100,
        power: 10,
        gold_coins: 0,
      });

      if (insertError) {
        console.error("OAuth sync character creation error:", insertError);
        return res
          .status(500)
          .json({ message: "Failed to initialize character." });
      }
    }

    return res.json({
      message: "Sync successful",
      user: {
        id: userId,
        email: userEmail,
        name: displayName,
      },
    });
  } catch (err) {
    console.error("OAuth sync error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
