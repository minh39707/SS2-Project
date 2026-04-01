const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");

const router = express.Router();

const ONBOARDING_DESCRIPTION_PREFIX = "Created during onboarding.";

function toFrequencyType(frequency) {
  if (frequency === "specific_days") {
    return "weekly";
  }

  return "daily";
}

function buildHabitPayload(userId, body) {
  const {
    habit_name,
    habit_type,
    life_area_label,
    time_period,
    time_exact,
    frequency,
    specific_days,
  } = body;

  return {
    user_id: userId,
    title: habit_name,
    description: `${ONBOARDING_DESCRIPTION_PREFIX} Area: ${life_area_label ?? "General"}. Scheduled: ${time_period ?? "morning"} at ${time_exact ?? "07:00"}`,
    habit_type: habit_type === "bad" ? "negative" : "positive",
    tracking_method: "boolean",
    frequency_type: toFrequencyType(frequency),
    frequency_days: specific_days ?? [],
    hp_reward: 10,
    exp_reward: 20,
    hp_penalty: 15,
    streak_bonus_exp: 5,
    target_value: 1,
    target_unit: "times",
    is_active: true,
  };
}

// POST /api/onboarding/sync
router.post("/sync", requireUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { habit_name } = req.body;

    if (!habit_name) {
      return res.status(400).json({ message: "Habit name is required." });
    }

    const habitPayload = buildHabitPayload(userId, req.body);

    const { data: existingOnboardingHabits, error: existingHabitError } =
      await supabase
        .from("habits")
        .select("habit_id")
        .eq("user_id", userId)
        .ilike("description", `${ONBOARDING_DESCRIPTION_PREFIX}%`)
        .order("created_at", { ascending: false })
        .limit(20);

    if (existingHabitError) {
      console.error("Onboarding sync lookup error:", existingHabitError);
      return res.status(400).json({ message: existingHabitError.message });
    }

    const [existingOnboardingHabit, ...duplicateOnboardingHabits] =
      existingOnboardingHabits ?? [];

    const query = existingOnboardingHabit
      ? supabase
          .from("habits")
          .update(habitPayload)
          .eq("habit_id", existingOnboardingHabit.habit_id)
      : supabase.from("habits").insert(habitPayload);

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Onboarding sync error:", error);
      return res.status(400).json({ message: error.message });
    }

    if (duplicateOnboardingHabits.length > 0) {
      const duplicateIds = duplicateOnboardingHabits.map(
        (habit) => habit.habit_id,
      );
      const { error: deleteError } = await supabase
        .from("habits")
        .delete()
        .in("habit_id", duplicateIds);

      if (deleteError) {
        console.error("Onboarding cleanup error:", deleteError);
      }
    }

    return res.json({
      habit: data,
      mode: existingOnboardingHabit ? "updated" : "created",
    });
  } catch (err) {
    console.error("Onboarding sync error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
