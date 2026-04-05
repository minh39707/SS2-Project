const TIME_BASED_UNIT_ALIASES = {
  s: "seconds",
  sec: "seconds",
  secs: "seconds",
  second: "seconds",
  seconds: "seconds",
  m: "minutes",
  min: "minutes",
  mins: "minutes",
  minute: "minutes",
  minutes: "minutes",
  h: "hours",
  hr: "hours",
  hrs: "hours",
  hour: "hours",
  hours: "hours",
};

export function normalizeTimeBasedHabitUnit(unit) {
  const normalizedUnit = String(unit ?? "").trim().toLowerCase();
  return TIME_BASED_UNIT_ALIASES[normalizedUnit] ?? null;
}

export function isTimeBasedHabitUnit(unit) {
  return normalizeTimeBasedHabitUnit(unit) !== null;
}

export function convertHabitTargetToSeconds(targetValue, targetUnit) {
  const numericValue = Number(targetValue);
  const normalizedUnit = normalizeTimeBasedHabitUnit(targetUnit);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  if (normalizedUnit === "hours") {
    return Math.round(numericValue * 60 * 60);
  }

  if (normalizedUnit === "minutes") {
    return Math.round(numericValue * 60);
  }

  if (normalizedUnit === "seconds") {
    return Math.round(numericValue);
  }

  return 0;
}

export function formatCountdown(totalSeconds) {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatFocusDuration(targetValue, targetUnit) {
  const numericValue = Number(targetValue);
  const normalizedUnit = normalizeTimeBasedHabitUnit(targetUnit);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0 minutes";
  }

  if (normalizedUnit === "hours") {
    return `${numericValue} hour${numericValue === 1 ? "" : "s"}`;
  }

  if (normalizedUnit === "minutes") {
    return `${numericValue} minute${numericValue === 1 ? "" : "s"}`;
  }

  if (normalizedUnit === "seconds") {
    return `${numericValue} second${numericValue === 1 ? "" : "s"}`;
  }

  return `${numericValue} ${targetUnit ?? "units"}`;
}
