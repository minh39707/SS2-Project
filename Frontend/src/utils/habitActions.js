import { isTimeBasedHabitUnit } from "@/src/utils/habitTimer";
import { getHabitTodayStatus, isNegativeHabit } from "@/src/utils/habitStatus";

export function openHabitFocusRoute(router, habitId) {
  router.push({
    pathname: "/habit-focus",
    params: { habitId },
  });
}

export function shouldOpenHabitFocus(habit) {
  return (
    !!habit?.id &&
    !!habit?.isScheduledToday &&
    !habit?.completedToday &&
    !isNegativeHabit(habit) &&
    isTimeBasedHabitUnit(habit?.targetUnit)
  );
}

export function getHabitActionLabel(
  habit,
  options = {},
) {
  const {
    completed = "Undo",
    timed = "Start",
    complete = "Complete",
    open = "Open",
  } = options;

  if (habit?.completedToday) {
    return completed;
  }

  if (!habit?.isScheduledToday) {
    return open;
  }

  if (isNegativeHabit(habit)) {
    const status = getHabitTodayStatus(habit);

    if (status === "failed") {
      return "Logged slip";
    }

    if (status === "avoided") {
      return "Avoided today";
    }

    return "Check in";
  }

  return isTimeBasedHabitUnit(habit?.targetUnit) ? timed : complete;
}

export function getHabitActionIcon(
  habit,
  options = {},
) {
  const {
    completed = "refresh-outline",
    timed = "timer-outline",
    complete = "checkmark-circle-outline",
    open = "open-outline",
  } = options;

  if (habit?.completedToday) {
    return completed;
  }

  if (!habit?.isScheduledToday) {
    return open;
  }

  if (isNegativeHabit(habit)) {
    const status = getHabitTodayStatus(habit);

    if (status === "failed") {
      return "warning-outline";
    }

    if (status === "avoided") {
      return "shield-checkmark-outline";
    }

    return "help-circle-outline";
  }

  return isTimeBasedHabitUnit(habit?.targetUnit) ? timed : complete;
}
