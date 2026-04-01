import { DAY_OPTIONS, DEFAULT_TIME_BY_PERIOD, LIFE_AREA_OPTIONS, PRESET_HABITS } from '../constants/onboarding';

export function getDefaultTimeForPeriod(period) {
  return DEFAULT_TIME_BY_PERIOD[period];
}

export function formatTimeLabel(time24) {
  const [hourString, minuteString] = time24.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  const formattedMinute = String(minute).padStart(2, '0');
  return `${normalizedHour}:${formattedMinute} ${period}`;
}

export function getLifeAreaLabel(value) {
  return LIFE_AREA_OPTIONS.find((option) => option.value === value)?.label ?? 'Not chosen yet';
}

export function getHabitDisplayName(habitName, habitType) {
  if (!habitName) {
    return 'Not selected yet';
  }

  if (habitType === 'custom') {
    return habitName;
  }

  return PRESET_HABITS.find((habit) => habit.value === habitName)?.label ?? habitName;
}

export function getFrequencyLabel(frequency, specificDays) {
  if (frequency === 'specific_days') {
    if (!specificDays.length) {
      return 'Choose at least one day';
    }

    const labels = specificDays
      .map((day) => DAY_OPTIONS.find((option) => option.value === day)?.short ?? day)
      .join(', ');

    return `Specific days: ${labels}`;
  }

  if (frequency === 'everyday') {
    return 'Every day';
  }

  if (frequency === 'weekdays') {
    return 'Weekdays';
  }

  return 'Weekends';
}

export function isSpecificDaysValid(frequency, specificDays) {
  return frequency !== 'specific_days' || specificDays.length > 0;
}

export function isOnboardingReadyForSchedule(habitName) {
  return Boolean(habitName);
}

export function isOnboardingReadyForSave(habitName) {
  return Boolean(habitName);
}

export function toTimePickerParts(time24) {
  const [hourString, minuteString] = time24.split(':');
  const hour24 = Number(hourString);
  const minute = Number(minuteString);
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;

  return {
    hour,
    minute,
    meridiem,
  };
}

export function fromTimePickerParts(hour, minute, meridiem) {
  let hour24 = hour % 12;

  if (meridiem === 'PM') {
    hour24 += 12;
  }

  if (meridiem === 'AM' && hour === 12) {
    hour24 = 0;
  }

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
