const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const {
  ALL_DAY_NUMBERS,
  toFrequencyDayKeys,
  toFrequencyDayNumbers,
} = require("../utils/frequencyDays");

const router = express.Router();

const DEFAULT_REMINDER_BY_TIME = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "20:00",
};
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedCategoryMap = null;
let cachedCategoryMapExpiresAt = 0;

function normalizeFrequencyDays(frequencyType, frequencyDays) {
  if (frequencyType === "daily") {
    return ALL_DAY_NUMBERS;
  }

  if (frequencyType === "weekly") {
    return toFrequencyDayNumbers(frequencyDays);
  }

  return [];
}

function getDefaultReminder(preferredTime) {
  return DEFAULT_REMINDER_BY_TIME[preferredTime] ?? DEFAULT_REMINDER_BY_TIME.morning;
}

function getDefaultStartDate(createdAt) {
  return (createdAt ?? new Date().toISOString()).split("T")[0];
}

function parseFormDescription(description, createdAt) {
  const categoryMatch = description?.match(/Category:\s(.+?)\./i);
  const preferredTimeMatch = description?.match(/Preferred time:\s(.+?)\./i);
  const startDateMatch = description?.match(/Start date:\s(\d{4}-\d{2}-\d{2})\./i);
  const reminderMatch = description?.match(/Reminders:\s(.+?)\./i);

  const preferredTime = preferredTimeMatch?.[1] ?? "morning";
  const reminders =
    reminderMatch?.[1] && reminderMatch[1] !== "No reminders"
      ? reminderMatch[1].split(",").map((item) => item.trim()).filter(Boolean)
      : [getDefaultReminder(preferredTime)];

  return {
    categoryLabel: categoryMatch?.[1] ?? null,
    preferredTime,
    startDate: startDateMatch?.[1] ?? getDefaultStartDate(createdAt),
    reminders,
  };
}

function parseOnboardingDescription(description, createdAt) {
  const areaMatch = description?.match(/Area:\s(.+?)\.\sScheduled:/i);
  const scheduleMatch = description?.match(/Scheduled:\s(\w+)\sat\s(\d{2}:\d{2})/i);
  const preferredTime = scheduleMatch?.[1] ?? "morning";
  const reminderTime = scheduleMatch?.[2] ?? getDefaultReminder(preferredTime);

  return {
    categoryLabel: areaMatch?.[1] ?? null,
    preferredTime,
    startDate: getDefaultStartDate(createdAt),
    reminders: [reminderTime],
  };
}

function extractHabitMetadata(description, createdAt) {
  if (typeof description !== "string") {
    return {
      categoryLabel: null,
      preferredTime: "morning",
      startDate: getDefaultStartDate(createdAt),
      reminders: [getDefaultReminder("morning")],
    };
  }

  if (description.startsWith("Created from mobile habit form.")) {
    return parseFormDescription(description, createdAt);
  }

  if (description.startsWith("Created during onboarding.")) {
    return parseOnboardingDescription(description, createdAt);
  }

  return {
    categoryLabel: null,
    preferredTime: "morning",
    startDate: getDefaultStartDate(createdAt),
    reminders: [getDefaultReminder("morning")],
  };
}

async function loadCategoryMap() {
  if (cachedCategoryMap && cachedCategoryMapExpiresAt > Date.now()) {
    return cachedCategoryMap;
  }

  const { data, error } = await supabase
    .from("habit_categories")
    .select("category_id, name");

  if (error) {
    throw error;
  }

  cachedCategoryMap = new Map(
    (data ?? []).map((category) => [category.category_id, category.name]),
  );
  cachedCategoryMapExpiresAt = Date.now() + CATEGORY_CACHE_TTL_MS;

  return cachedCategoryMap;
}

async function resolveCategoryId(categoryLabel) {
  if (!categoryLabel) {
    return null;
  }

  const { data, error } = await supabase
    .from("habit_categories")
    .select("category_id")
    .ilike("name", categoryLabel)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.category_id ?? null;
}

function buildDescription({
  categoryLabel,
  preferredTime,
  startDate,
  reminders,
  frequencyType,
}) {
  const reminderLabel =
    reminders?.length > 0 ? reminders.join(", ") : "No reminders";

  return [
    "Created from mobile habit form.",
    `Category: ${categoryLabel ?? "General"}.`,
    `Preferred time: ${preferredTime ?? "morning"}.`,
    `Start date: ${startDate ?? getDefaultStartDate()}.`,
    `Frequency: ${frequencyType ?? "daily"}.`,
    `Reminders: ${reminderLabel}.`,
  ].join(" ");
}

function normalizePayload(body) {
  const trimmedTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const normalizedFrequencyType =
    body?.frequencyType === "weekly" || body?.frequencyType === "monthly"
      ? body.frequencyType
      : "daily";
  const normalizedDays = normalizeFrequencyDays(
    normalizedFrequencyType,
    body?.frequencyDays,
  );
  const normalizedTargetValue = Number(body?.targetValue);
  const preferredTime =
    body?.preferredTime === "afternoon" || body?.preferredTime === "evening"
      ? body.preferredTime
      : "morning";
  const reminders =
    Array.isArray(body?.reminders) && body.reminders.length > 0
      ? body.reminders
      : [getDefaultReminder(preferredTime)];

  return {
    trimmedTitle,
    normalizedFrequencyType,
    normalizedDays,
    normalizedTargetValue,
    habitType: body?.habitType === "negative" ? "negative" : "positive",
    targetUnit: typeof body?.targetUnit === "string" ? body.targetUnit : "times",
    preferredTime,
    categoryLabel: typeof body?.categoryLabel === "string" ? body.categoryLabel : null,
    startDate:
      typeof body?.startDate === "string" && body.startDate
        ? body.startDate
        : getDefaultStartDate(),
    reminders,
  };
}

function validatePayload(payload) {
  if (!payload.trimmedTitle) {
    return "Habit title is required.";
  }

  if (
    payload.normalizedFrequencyType === "weekly" &&
    payload.normalizedDays.length === 0
  ) {
    return "Please choose at least one day for a weekly habit.";
  }

  if (
    !Number.isFinite(payload.normalizedTargetValue) ||
    payload.normalizedTargetValue <= 0
  ) {
    return "Target value must be greater than zero.";
  }

  return null;
}

function serializeHabit(habit, categoryMap) {
  const metadata = extractHabitMetadata(habit.description, habit.created_at);

  return {
    id: habit.habit_id,
    title: habit.title,
    habitType: habit.habit_type,
    targetValue: Number(habit.target_value ?? 1),
    targetUnit: habit.target_unit ?? "times",
    frequencyType: habit.frequency_type ?? "daily",
    frequencyDays: toFrequencyDayKeys(habit.frequency_days ?? []),
    categoryLabel:
      categoryMap.get(habit.category_id) ?? metadata.categoryLabel ?? null,
    preferredTime: metadata.preferredTime,
    startDate: metadata.startDate,
    reminders: metadata.reminders,
    isActive: habit.is_active ?? true,
    createdAt: habit.created_at,
    updatedAt: habit.updated_at,
  };
}

async function fetchHabitById(habitId, userId) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("habit_id", habitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

router.get("/", requireUser, async (req, res) => {
  try {
    const [categoryMap, habitsResult] = await Promise.all([
      loadCategoryMap(),
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", req.userId)
        .order("created_at", { ascending: false }),
    ]);

    if (habitsResult.error) {
      console.error("List habits error:", habitsResult.error);
      return res.status(400).json({ message: habitsResult.error.message });
    }

    return res.json({
      habits: (habitsResult.data ?? []).map((habit) =>
        serializeHabit(habit, categoryMap),
      ),
    });
  } catch (error) {
    console.error("List habits error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/:habitId", requireUser, async (req, res) => {
  try {
    const [categoryMap, habit] = await Promise.all([
      loadCategoryMap(),
      fetchHabitById(req.params.habitId, req.userId),
    ]);

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    return res.json({ habit: serializeHabit(habit, categoryMap) });
  } catch (error) {
    console.error("Get habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/", requireUser, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const categoryId = await resolveCategoryId(payload.categoryLabel);

    const habitPayload = {
      user_id: req.userId,
      category_id: categoryId,
      title: payload.trimmedTitle,
      description: buildDescription(payload),
      habit_type: payload.habitType,
      tracking_method: "boolean",
      target_value: payload.normalizedTargetValue,
      target_unit: payload.targetUnit,
      frequency_type: payload.normalizedFrequencyType,
      frequency_days: payload.normalizedDays,
      hp_reward: 10,
      exp_reward: 20,
      hp_penalty: 15,
      streak_bonus_exp: 5,
      is_active: true,
    };

    const { data, error } = await supabase
      .from("habits")
      .insert(habitPayload)
      .select()
      .single();

    if (error) {
      console.error("Create habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    const categoryMap = await loadCategoryMap();

    return res.status(201).json({ habit: serializeHabit(data, categoryMap) });
  } catch (error) {
    console.error("Create habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.patch("/:habitId", requireUser, async (req, res) => {
  try {
    const existingHabit = await fetchHabitById(req.params.habitId, req.userId);

    if (!existingHabit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const categoryId = await resolveCategoryId(payload.categoryLabel);
    const habitPayload = {
      category_id: categoryId,
      title: payload.trimmedTitle,
      description: buildDescription(payload),
      habit_type: payload.habitType,
      target_value: payload.normalizedTargetValue,
      target_unit: payload.targetUnit,
      frequency_type: payload.normalizedFrequencyType,
      frequency_days: payload.normalizedDays,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("habits")
      .update(habitPayload)
      .eq("habit_id", req.params.habitId)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error) {
      console.error("Update habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    const categoryMap = await loadCategoryMap();

    return res.json({ habit: serializeHabit(data, categoryMap) });
  } catch (error) {
    console.error("Update habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.delete("/:habitId", requireUser, async (req, res) => {
  try {
    const existingHabit = await fetchHabitById(req.params.habitId, req.userId);

    if (!existingHabit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("habit_id", req.params.habitId)
      .eq("user_id", req.userId);

    if (error) {
      console.error("Delete habit error:", error);
      return res.status(400).json({ message: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete habit error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
