const POSITIVE_HABIT_TYPE = "positive";
const NEGATIVE_HABIT_TYPE = "negative";
const LEGACY_POSITIVE_HABIT_TYPES = new Set([
  POSITIVE_HABIT_TYPE,
  "good",
]);
const LEGACY_NEGATIVE_HABIT_TYPES = new Set([
  NEGATIVE_HABIT_TYPE,
  "bad",
]);

const GOOD_HABIT_SUCCESS_STATUSES = new Set(["completed"]);
const BAD_HABIT_SUCCESS_STATUSES = new Set(["avoided"]);
const SUCCESS_STATUSES = new Set([
  ...GOOD_HABIT_SUCCESS_STATUSES,
  ...BAD_HABIT_SUCCESS_STATUSES,
]);

const GOOD_HABIT_FAILURE_STATUSES = new Set(["missed", "punished"]);
const BAD_HABIT_FAILURE_STATUSES = new Set(["failed"]);

const GOOD_HABIT_STATUSES = [
  "completed",
  "missed",
  "punished",
];
const BAD_HABIT_STATUSES = [
  "avoided",
  "failed",
];
const MANUAL_GOOD_HABIT_STATUSES = [
  "completed",
  "missed",
];
const MANUAL_BAD_HABIT_STATUSES = [
  "avoided",
  "failed",
];

function getHabitType(habit) {
  const rawHabitType =
    typeof habit?.habit_type === "string"
      ? habit.habit_type.trim().toLowerCase()
      : typeof habit?.habitType === "string"
        ? habit.habitType.trim().toLowerCase()
        : null;

  if (LEGACY_NEGATIVE_HABIT_TYPES.has(rawHabitType)) {
    return NEGATIVE_HABIT_TYPE;
  }

  if (LEGACY_POSITIVE_HABIT_TYPES.has(rawHabitType)) {
    return POSITIVE_HABIT_TYPE;
  }

  return POSITIVE_HABIT_TYPE;
}

function isNegativeHabit(habit) {
  return getHabitType(habit) === NEGATIVE_HABIT_TYPE;
}

function isPositiveHabit(habit) {
  return getHabitType(habit) === POSITIVE_HABIT_TYPE;
}

function isSuccessStatus(status) {
  return SUCCESS_STATUSES.has(status);
}

function isFailureStatus(status) {
  return (
    GOOD_HABIT_FAILURE_STATUSES.has(status) ||
    BAD_HABIT_FAILURE_STATUSES.has(status)
  );
}

function isSuccessfulLogForHabit(habit, log) {
  if (!log) {
    return false;
  }

  const status = log.status ?? null;

  if (!status) {
    return false;
  }

  if (isPositiveHabit(habit)) {
    return GOOD_HABIT_SUCCESS_STATUSES.has(status);
  }

  return BAD_HABIT_SUCCESS_STATUSES.has(status);
}

function getAllowedStatusesForHabit(habit, { manualOnly = false } = {}) {
  if (isNegativeHabit(habit)) {
    return manualOnly ? MANUAL_BAD_HABIT_STATUSES : BAD_HABIT_STATUSES;
  }

  return manualOnly ? MANUAL_GOOD_HABIT_STATUSES : GOOD_HABIT_STATUSES;
}

function isAllowedStatusForHabit(habit, status, options = {}) {
  return getAllowedStatusesForHabit(habit, options).includes(status);
}

function deriveTodayStatus(habit, todayLog, isScheduledToday = true) {
  if (!isScheduledToday) {
    return null;
  }

  if (todayLog?.status) {
    return todayLog.status;
  }

  if (!todayLog && isNegativeHabit(habit)) {
    return "unverified";
  }

  return null;
}

module.exports = {
  BAD_HABIT_FAILURE_STATUSES,
  BAD_HABIT_STATUSES,
  GOOD_HABIT_FAILURE_STATUSES,
  GOOD_HABIT_STATUSES,
  NEGATIVE_HABIT_TYPE,
  POSITIVE_HABIT_TYPE,
  deriveTodayStatus,
  getAllowedStatusesForHabit,
  getHabitType,
  isAllowedStatusForHabit,
  isFailureStatus,
  isNegativeHabit,
  isPositiveHabit,
  isSuccessStatus,
  isSuccessfulLogForHabit,
};
