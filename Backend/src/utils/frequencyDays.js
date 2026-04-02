const DAY_KEY_TO_NUMBER = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

const DAY_NUMBER_TO_KEY = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  7: "sun",
};

const ALL_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ALL_DAY_NUMBERS = ALL_DAY_KEYS.map((dayKey) => DAY_KEY_TO_NUMBER[dayKey]);

function toFrequencyDayNumbers(dayKeys) {
  if (!Array.isArray(dayKeys)) {
    return [];
  }

  return dayKeys
    .map((dayKey) =>
      typeof dayKey === "number"
        ? dayKey
        : DAY_KEY_TO_NUMBER[String(dayKey).toLowerCase()],
    )
    .filter((dayNumber) => Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 7);
}

function toFrequencyDayKeys(dayNumbers) {
  if (!Array.isArray(dayNumbers)) {
    return [];
  }

  return dayNumbers
    .map((dayNumber) =>
      typeof dayNumber === "string"
        ? String(dayNumber).toLowerCase()
        : DAY_NUMBER_TO_KEY[dayNumber],
    )
    .filter((dayKey) => ALL_DAY_KEYS.includes(dayKey));
}

module.exports = {
  ALL_DAY_KEYS,
  ALL_DAY_NUMBERS,
  toFrequencyDayNumbers,
  toFrequencyDayKeys,
};
