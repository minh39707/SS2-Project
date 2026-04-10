export function normalizeHabitType(habitType) {
  const normalizedValue =
    typeof habitType === "string" ? habitType.trim().toLowerCase() : "";

  return normalizedValue === "negative" || normalizedValue === "bad"
    ? "negative"
    : "positive";
}

export function isNegativeHabitType(habitType) {
  return normalizeHabitType(habitType) === "negative";
}

export function isNegativeHabit(habit) {
  return isNegativeHabitType(habit?.habitType ?? habit?.habit_type);
}

export function getHabitTodayStatus(habit) {
  if (habit?.todayStatus) {
    return habit.todayStatus;
  }

  if (!habit?.isScheduledToday) {
    return null;
  }

  if (isNegativeHabit(habit)) {
    return "unverified";
  }

  return habit?.completedToday ? "completed" : null;
}

export function isHabitSuccessStatus(status) {
  return status === "completed" || status === "avoided";
}

export function getBadHabitStatusLabel(habit) {
  const status = getHabitTodayStatus(habit);

  if (status === "avoided") {
    return "Avoided today";
  }

  if (status === "failed") {
    return "I slipped";
  }

  if (status === "unverified") {
    return "Unverified";
  }

  return habit?.isScheduledToday ? "Check in today" : "Not due today";
}

export function getBadHabitStatusLabelVi(habit) {
  const status = getHabitTodayStatus(habit);

  if (status === "avoided") {
    return "H\u00f4m nay v\u1eabn \u1ed5n";
  }

  if (status === "failed") {
    return "\u0110\u00e3 ph\u1ea1m";
  }

  if (status === "unverified") {
    return "Ch\u01b0a x\u00e1c nh\u1eadn";
  }

  return habit?.isScheduledToday
    ? "Ch\u1edd x\u00e1c nh\u1eadn"
    : "H\u00f4m nay kh\u00f4ng \u0111\u1ebfn l\u1ecbch";
}
