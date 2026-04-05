import { isTimeBasedHabitUnit } from "@/src/utils/habitTimer";

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

  return isTimeBasedHabitUnit(habit?.targetUnit) ? timed : complete;
}
