import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import EmptyStateCard from "@/src/components/EmptyStateCard";
import ScreenContainer from "@/src/components/ScreenContainer";
import TimePickerModal from "@/src/components/TimePickerModal";
import { Text } from "@/src/components/ui/Text";
import { LIFE_AREA_OPTIONS } from "@/src/constants/onboarding";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import {
  createHabit,
  deleteHabit,
  getHabitById,
  updateHabit,
} from "@/src/services/habit.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import { formatTimeLabel } from "@/src/utils/onboarding";

const WEEKDAY_OPTIONS = [
  { label: "M", value: "mon" },
  { label: "T", value: "tue" },
  { label: "W", value: "wed" },
  { label: "T", value: "thu" },
  { label: "F", value: "fri" },
  { label: "S", value: "sat" },
  { label: "S", value: "sun" },
];

const ALL_WEEK_DAYS = WEEKDAY_OPTIONS.map((day) => day.value);
const FREQUENCY_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];
const PREFERRED_TIME_OPTIONS = [
  { label: "Morning", value: "morning", icon: "sunny" },
  { label: "Afternoon", value: "afternoon", icon: "partly-sunny" },
  { label: "Evening", value: "evening", icon: "moon" },
];
const TARGET_UNIT_OPTIONS = [
  { label: "times", value: "times" },
  { label: "steps", value: "steps" },
  { label: "cal", value: "cal" },
  { label: "kcal", value: "kcal" },
  { label: "seconds", value: "seconds" },
  { label: "minutes", value: "minutes" },
  { label: "hours", value: "hours" },
  { label: "g", value: "g" },
  { label: "kg", value: "kg" },
  { label: "mL", value: "mL" },
  { label: "L", value: "L" },
  { label: "m", value: "m" },
  { label: "km", value: "km" },
  { label: "Custom", value: "custom" },
];
const HABIT_TYPE_OPTIONS = [
  {
    label: "Good Habit",
    value: "positive",
    icon: "leaf",
    activeBackground: "#EAF4FF",
    activeBorder: "#BFDBFE",
  },
  {
    label: "Bad Habit",
    value: "negative",
    icon: "ban",
    activeBackground: "#FFF1E8",
    activeBorder: "#FBC9A8",
  },
];
const REMINDER_BY_TIME = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "20:00",
};

function getTodayDay() {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[new Date().getDay()] ?? "mon";
}

function getDefaultWeeklyDays() {
  return [getTodayDay()];
}

function getDefaultReminder(preferredTime) {
  return REMINDER_BY_TIME[preferredTime] ?? REMINDER_BY_TIME.morning;
}

function getStartDateLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date);
}

function getHeaderDateLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  })
    .format(date)
    .toUpperCase();
}

function resolveCategoryOption(categoryLabel) {
  return (
    LIFE_AREA_OPTIONS.find((option) => option.label === categoryLabel) ??
    LIFE_AREA_OPTIONS[0]
  );
}

function toDateFromValue(value) {
  const parsedDate = value ? new Date(value) : new Date();
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

function normalizeTargetValueInput(value) {
  return value.replace(",", ".").replace(/[^0-9.]/g, "");
}

function getTargetValueDisplay(value) {
  if (!Number.isFinite(value)) {
    return "1";
  }

  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeHabitType(value) {
  return value === "negative" || value === "bad" ? "negative" : "positive";
}

function getPeriodLabel(frequencyType) {
  if (frequencyType === "monthly") {
    return "month";
  }

  if (frequencyType === "weekly") {
    return "week";
  }

  return "day";
}

function getDisplayTargetUnit(targetValue, targetUnit) {
  if (!targetUnit) {
    return "unit";
  }

  if (targetUnit === "times" && Number(targetValue) === 1) {
    return "time";
  }

  return targetUnit;
}

function getErrorPlacement(errorMessage) {
  if (!errorMessage) {
    return null;
  }

  if (errorMessage === "Please enter a habit name." || errorMessage === "Habit title is required.") {
    return "name";
  }

  if (
    errorMessage === "Please choose at least one active day." ||
    errorMessage === "Please choose at least one day for a weekly habit."
  ) {
    return "frequency";
  }

  if (
    errorMessage === "Please enter a valid target number greater than zero." ||
    errorMessage === "Target value must be greater than zero." ||
    errorMessage === "Please choose or enter a target unit."
  ) {
    return "goal";
  }

  return "general";
}

export default function CreateHabitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const habitId = Array.isArray(params.habitId) ? params.habitId[0] : params.habitId;
  const requestedHabitType = Array.isArray(params.habitType)
    ? params.habitType[0]
    : params.habitType;
  const isEditMode = Boolean(habitId);
  const { completed, userProfile } = useOnboarding();

  const [habitType, setHabitType] = useState(() =>
    normalizeHabitType(requestedHabitType),
  );
  const [habitName, setHabitName] = useState("");
  const [frequencyType, setFrequencyType] = useState("daily");
  const [frequencyDays, setFrequencyDays] = useState(ALL_WEEK_DAYS);
  const [targetValueInput, setTargetValueInput] = useState("1");
  const [targetUnit, setTargetUnit] = useState("times");
  const [customTargetUnit, setCustomTargetUnit] = useState("");
  const [preferredTime, setPreferredTime] = useState("morning");
  const [selectedCategory, setSelectedCategory] = useState(LIFE_AREA_OPTIONS[0]);
  const [startDate, setStartDate] = useState(() => new Date());
  const [reminders, setReminders] = useState(["08:00"]);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [editingReminderIndex, setEditingReminderIndex] = useState(0);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingHabit, setIsLoadingHabit] = useState(isEditMode);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const normalizedRequestedHabitType = normalizeHabitType(requestedHabitType);
    const defaultPreferredTime = "morning";

    setHabitType(normalizedRequestedHabitType);
    setHabitName("");
    setFrequencyType("daily");
    setFrequencyDays(ALL_WEEK_DAYS);
    setTargetValueInput("1");
    setTargetUnit("times");
    setCustomTargetUnit("");
    setPreferredTime(defaultPreferredTime);
    setSelectedCategory(LIFE_AREA_OPTIONS[0]);
    setStartDate(new Date());
    setReminders([getDefaultReminder(defaultPreferredTime)]);
    setError(null);
    setIsLoadingHabit(false);
  }, [isEditMode, requestedHabitType]);

  useEffect(() => {
    if (!isEditMode || !habitId || !userProfile?.id) {
      setIsLoadingHabit(false);
      return;
    }

    let isMounted = true;

    const loadHabit = async () => {
      setIsLoadingHabit(true);
      setError(null);

      try {
        const response = await getHabitById(habitId, userProfile);
        const habit = response?.habit;

        if (!habit || !isMounted) {
          return;
        }

        setHabitType(normalizeHabitType(habit.habitType));
        setHabitName(habit.title ?? "");
        setFrequencyType(habit.frequencyType ?? "daily");
        setFrequencyDays(
          habit.frequencyType === "weekly"
            ? habit.frequencyDays ?? getDefaultWeeklyDays()
            : habit.frequencyType === "daily"
              ? ALL_WEEK_DAYS
              : [],
        );
        setTargetValueInput(getTargetValueDisplay(Number(habit.targetValue ?? 1)));
        const matchedTargetUnit = TARGET_UNIT_OPTIONS.find(
          (option) => option.value === habit.targetUnit,
        );
        setTargetUnit(matchedTargetUnit ? matchedTargetUnit.value : "custom");
        setCustomTargetUnit(matchedTargetUnit ? "" : habit.targetUnit ?? "");
        setPreferredTime(habit.preferredTime ?? "morning");
        setSelectedCategory(resolveCategoryOption(habit.categoryLabel));
        setStartDate(toDateFromValue(habit.startDate));
        setReminders(
          Array.isArray(habit.reminders) && habit.reminders.length > 0
            ? habit.reminders
            : [getDefaultReminder(habit.preferredTime)],
        );
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this habit.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingHabit(false);
        }
      }
    };

    void loadHabit();

    return () => {
      isMounted = false;
    };
  }, [habitId, isEditMode, userProfile]);

  if (!completed || !userProfile?.id) {
    return (
      <ScreenContainer contentContainerStyle={styles.emptyWrap}>
        <EmptyStateCard
          actionLabel="Continue to Login"
          description="Sign in first, then you can create, edit, and delete habits here."
          onAction={() => router.replace("/welcome")}
          title="Sign in required"
        />
      </ScreenContainer>
    );
  }

  if (isLoadingHabit) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const handleFrequencyChange = (nextFrequency) => {
    setFrequencyType(nextFrequency);
    setError(null);

    if (nextFrequency === "daily") {
      setFrequencyDays(ALL_WEEK_DAYS);
      return;
    }

    if (nextFrequency === "weekly") {
      setFrequencyDays((currentDays) =>
        currentDays.length > 0 ? currentDays : getDefaultWeeklyDays(),
      );
      return;
    }

    setFrequencyDays([]);
  };

  const toggleDay = (dayValue) => {
    if (frequencyType !== "weekly") {
      return;
    }

    setFrequencyDays((currentDays) => {
      if (currentDays.includes(dayValue)) {
        if (currentDays.length === 1) {
          return currentDays;
        }

        return currentDays.filter((day) => day !== dayValue);
      }

      return [...currentDays, dayValue];
    });
  };

  const resolvedTargetValue = Number.parseFloat(targetValueInput);
  const safeTargetValue = Number.isFinite(resolvedTargetValue)
    ? resolvedTargetValue
    : 1;
  const resolvedTargetUnit =
    targetUnit === "custom" ? customTargetUnit.trim() : targetUnit;
  const periodLabel = getPeriodLabel(frequencyType);
  const isNegativeHabit = habitType === "negative";
  const displayTargetUnit = getDisplayTargetUnit(safeTargetValue, resolvedTargetUnit);
  const errorPlacement = getErrorPlacement(error);

  const adjustTargetValue = (delta) => {
    const nextValue = Math.max(0.1, safeTargetValue + delta);
    setTargetValueInput(getTargetValueDisplay(nextValue));
  };

  const openReminderPicker = (index) => {
    setEditingReminderIndex(index);
    setIsTimePickerVisible(true);
  };

  const handleReminderConfirm = (nextTime) => {
    setReminders((currentReminders) =>
      currentReminders.map((reminder, index) =>
        index === editingReminderIndex ? nextTime : reminder,
      ),
    );
    setIsTimePickerVisible(false);
  };

  const handleAddReminder = () => {
    setReminders((currentReminders) => [
      ...currentReminders,
      getDefaultReminder(preferredTime),
    ]);
  };

  const handleRemoveReminder = (indexToRemove) => {
    if (reminders.length === 1) {
      return;
    }

    setReminders((currentReminders) =>
      currentReminders.filter((_, index) => index !== indexToRemove),
    );
  };

  const buildPayload = () => ({
    title: habitName.trim(),
    habitType,
    targetValue: safeTargetValue,
    targetUnit: resolvedTargetUnit,
    frequencyType,
    frequencyDays: frequencyType === "weekly" ? frequencyDays : [],
    preferredTime,
    categoryLabel: selectedCategory.label,
    startDate: startDate.toISOString().split("T")[0],
    reminders,
  });

  const handleSave = async () => {
    const trimmedName = habitName.trim();

    if (!trimmedName) {
      setError("Please enter a habit name.");
      return;
    }

    if (frequencyType === "weekly" && frequencyDays.length === 0) {
      setError("Please choose at least one active day.");
      return;
    }

    if (!Number.isFinite(resolvedTargetValue) || resolvedTargetValue <= 0) {
      setError("Please enter a valid target number greater than zero.");
      return;
    }

    if (!resolvedTargetUnit) {
      setError("Please choose or enter a target unit.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isEditMode && habitId) {
        await updateHabit(habitId, buildPayload(), userProfile);
      } else {
        await createHabit(buildPayload(), userProfile);
      }

      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Unable to ${isEditMode ? "update" : "create"} your habit right now.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete habit",
      "This will remove the habit from your list. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDelete();
          },
        },
      ],
    );
  };

  const handleDelete = async () => {
    if (!habitId) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteHabit(habitId, userProfile);
      router.replace("/habit-manage");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this habit right now.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ScreenContainer contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerIcon,
              pressed && styles.headerIconPressed,
            ]}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>

          <Text style={styles.headerTitle} variant="subtitle">
            {isEditMode ? "Edit Habit" : "Create New Habit"}
          </Text>

          <Pressable
            disabled={isSaving || isDeleting}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !isSaving && !isDeleting && styles.saveButtonPressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text color="primary" variant="label">
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text color="muted" variant="caption">
            What&apos;s your habit?
          </Text>
          <TextInput
            autoFocus={!isEditMode}
            onChangeText={(text) => {
              setHabitName(text);
              if (error) {
                setError(null);
              }
            }}
            placeholder="Drink 2L Water"
            placeholderTextColor="#AAB5C4"
            style={styles.input}
            value={habitName}
          />
          {errorPlacement === "name" ? (
            <Text style={styles.errorText} variant="caption">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} variant="subtitle">
            Habit Type
          </Text>
          <View style={styles.habitTypeRow}>
            {HABIT_TYPE_OPTIONS.map((option) => {
              const isActive = habitType === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setHabitType(option.value)}
                  style={[
                    styles.habitTypeCard,
                    isActive && {
                      backgroundColor: option.activeBackground,
                      borderColor: option.activeBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.habitTypeIconWrap,
                      isActive && styles.habitTypeIconWrapActive,
                    ]}
                  >
                    <Ionicons
                      color={option.value === "negative" ? "#B45309" : colors.primary}
                      name={option.icon}
                      size={18}
                    />
                  </View>
                  <Text style={styles.habitTypeLabel} variant="body">
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} variant="subtitle">
            Frequency
          </Text>
          <View style={styles.segmentRow}>
            {FREQUENCY_OPTIONS.map((option) => {
              const isActive = frequencyType === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleFrequencyChange(option.value)}
                  style={[
                    styles.segmentButton,
                    isActive && styles.segmentButtonActive,
                  ]}
                >
                  <Text
                    color={isActive ? "white" : "muted"}
                    style={isActive && styles.segmentTextActive}
                    variant="caption"
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dayRow}>
            {WEEKDAY_OPTIONS.map((day, index) => {
              const isActive =
                frequencyType === "daily"
                  ? true
                  : frequencyType === "weekly"
                    ? frequencyDays.includes(day.value)
                    : false;
              const isDisabled = frequencyType !== "weekly";

              return (
                <Pressable
                  key={`${day.value}-${index}`}
                  disabled={isDisabled}
                  onPress={() => toggleDay(day.value)}
                  style={[
                    styles.dayButton,
                    isActive && styles.dayButtonActive,
                    isDisabled && styles.dayButtonDisabled,
                  ]}
                >
                  <Text
                    color={isActive ? "white" : "muted"}
                    style={isActive && styles.dayLabelActive}
                    variant="label"
                  >
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errorPlacement === "frequency" ? (
            <Text style={styles.errorText} variant="caption">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.sectionTitle} variant="subtitle">
              {isNegativeHabit ? "Your Limit" : "Your Goal"}
            </Text>
            <Text color="primary" variant="caption">
              {isNegativeHabit ? "Up to" : ""}
              {isNegativeHabit ? " " : ""}
              {safeTargetValue} {resolvedTargetUnit || "unit"} per {periodLabel}
            </Text>
          </View>

          <View style={styles.goalValueRow}>
            <Pressable
              onPress={() => adjustTargetValue(-1)}
              style={({ pressed }) => [
                styles.goalAction,
                pressed && styles.goalActionPressed,
              ]}
            >
              <Ionicons color={colors.text} name="remove" size={18} />
            </Pressable>

            <View style={styles.goalValueWrap}>
              <Text color="muted" style={styles.goalHintText} variant="caption">
                {isNegativeHabit ? "Maximum allowed" : "Enter your target"}
              </Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(text) => {
                  setTargetValueInput(normalizeTargetValueInput(text));
                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="1"
                placeholderTextColor="#AAB5C4"
                style={styles.goalValueInput}
                value={targetValueInput}
              />
              <Text color="muted" style={styles.goalSubtext} variant="body">
                {isNegativeHabit
                  ? `At most ${safeTargetValue} ${displayTargetUnit} per ${periodLabel}`
                  : `${displayTargetUnit} per ${periodLabel}`}
              </Text>
            </View>

            <Pressable
              onPress={() => adjustTargetValue(safeTargetValue < 10 ? 1 : 0.5)}
              style={({ pressed }) => [
                styles.goalAction,
                pressed && styles.goalActionPressed,
              ]}
            >
              <Ionicons color={colors.text} name="add" size={18} />
            </Pressable>
          </View>

          <View style={styles.unitRow}>
            {TARGET_UNIT_OPTIONS.map((option) => {
              const isActive = targetUnit === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setTargetUnit(option.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  style={[
                    styles.unitChip,
                    isActive && styles.unitChipActive,
                  ]}
                >
                  <Text
                    color={isActive ? "primary" : "muted"}
                    style={isActive && styles.unitChipTextActive}
                    variant="caption"
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {targetUnit === "custom" ? (
            <TextInput
              onChangeText={(text) => {
                setCustomTargetUnit(text);
                if (error) {
                  setError(null);
                }
              }}
              placeholder="Enter custom unit"
              placeholderTextColor="#AAB5C4"
              style={styles.unitInput}
              value={customTargetUnit}
            />
          ) : null}
          {errorPlacement === "goal" ? (
            <Text style={styles.errorText} variant="caption">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} variant="subtitle">
            Preferred Time
          </Text>
          <View style={styles.timeRow}>
            {PREFERRED_TIME_OPTIONS.map((option) => {
              const isActive = preferredTime === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setPreferredTime(option.value)}
                  style={[
                    styles.timeButton,
                    isActive && styles.timeButtonActive,
                  ]}
                >
                  <Ionicons
                    color={isActive ? "#FFFFFF" : colors.textMuted}
                    name={option.icon}
                    size={16}
                  />
                  <Text
                    color={isActive ? "white" : "muted"}
                    style={isActive && styles.timeLabelActive}
                    variant="caption"
                  >
                    {option.label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} variant="subtitle">
            Category
          </Text>
          <Pressable
            onPress={() => setIsCategoryModalVisible(true)}
            style={({ pressed }) => [
              styles.selectCard,
              pressed && styles.selectCardPressed,
            ]}
          >
            <View style={styles.selectLeading}>
              <View style={styles.categoryIconWrap}>
                <Ionicons
                  color={colors.primary}
                  name={selectedCategory.icon}
                  size={16}
                />
              </View>
              <Text variant="body">{selectedCategory.label}</Text>
            </View>
            <Ionicons color="#94A3B8" name="chevron-down" size={18} />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text color="primary" style={styles.metaEyebrow} variant="caption">
              {getHeaderDateLabel(startDate)}
            </Text>
            <Text variant="subtitle">{getStartDateLabel(startDate)}</Text>
            <Ionicons
              color="#94A3B8"
              name="calendar-outline"
              size={16}
              style={styles.metaIcon}
            />
          </View>

          <View style={styles.metaCard}>
            <Text color="primary" style={styles.metaEyebrow} variant="caption">
              ACTIVE
            </Text>
            <Text variant="subtitle">{formatTimeLabel(reminders[0])}</Text>
            <Ionicons
              color="#94A3B8"
              name="notifications-outline"
              size={16}
              style={styles.metaIcon}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} variant="subtitle">
            Reminder
          </Text>
          <View style={styles.reminderList}>
            {reminders.map((reminder, index) => (
              <View key={`${reminder}-${index}`} style={styles.reminderChip}>
                <Pressable onPress={() => openReminderPicker(index)}>
                  <Text variant="body">{formatTimeLabel(reminder)}</Text>
                </Pressable>

                {reminders.length > 1 ? (
                  <Pressable onPress={() => handleRemoveReminder(index)}>
                    <Ionicons color="#94A3B8" name="close" size={18} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleAddReminder}
            style={({ pressed }) => [
              styles.addReminderButton,
              pressed && styles.addReminderButtonPressed,
            ]}
          >
            <Ionicons color="#64748B" name="add-circle-outline" size={18} />
            <Text color="muted" variant="body">
              Add Another Reminder
            </Text>
          </Pressable>
        </View>

        {errorPlacement === "general" ? (
          <Text style={styles.errorText} variant="caption">
            {error}
          </Text>
        ) : null}

        {isEditMode ? (
          <Pressable
            disabled={isDeleting || isSaving}
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && !isDeleting && styles.deleteButtonPressed,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <>
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
                <Text style={styles.deleteText} variant="label">
                  Delete Habit
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScreenContainer>

      <TimePickerModal
        initialTime={reminders[editingReminderIndex] ?? reminders[0]}
        onClose={() => setIsTimePickerVisible(false)}
        onConfirm={handleReminderConfirm}
        visible={isTimePickerVisible}
      />

      <Modal
        animationType="slide"
        transparent
        visible={isCategoryModalVisible}
      >
        <Pressable
          onPress={() => setIsCategoryModalVisible(false)}
          style={styles.modalOverlay}
        />
        <View style={styles.categoryModalSheet}>
          <View style={styles.modalGrabber} />
          <Text style={styles.modalTitle} variant="subtitle">
            Select Category
          </Text>

          <ScrollView
            contentContainerStyle={styles.categoryList}
            showsVerticalScrollIndicator={false}
          >
            {LIFE_AREA_OPTIONS.map((option) => {
              const isActive = selectedCategory.value === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setSelectedCategory(option);
                    setIsCategoryModalVisible(false);
                  }}
                  style={[
                    styles.categoryOption,
                    isActive && styles.categoryOptionActive,
                  ]}
                >
                  <View style={styles.selectLeading}>
                    <View style={styles.categoryIconWrap}>
                      <Ionicons
                        color={colors.primary}
                        name={option.icon}
                        size={16}
                      />
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text variant="body">{option.label}</Text>
                      <Text color="muted" variant="caption">
                        {option.description}
                      </Text>
                    </View>
                  </View>

                  {isActive ? (
                    <Ionicons
                      color={colors.primary}
                      name="checkmark-circle"
                      size={20}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconPressed: {
    backgroundColor: "#E8EEF8",
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    textAlign: "center",
  },
  saveButton: {
    minWidth: 52,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonPressed: {
    opacity: 0.7,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.xl,
    backgroundColor: "#EEF3F9",
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
  habitTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  habitTypeCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    justifyContent: "center",
  },
  habitTypeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  habitTypeIconWrapActive: {
    backgroundColor: "#FFFFFF",
  },
  habitTypeLabel: {
    fontWeight: "700",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#EAF0F7",
    borderRadius: radii.pill,
    padding: 4,
  },
  segmentButton: {
    minWidth: 74,
    minHeight: 30,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    ...shadows.soft,
  },
  segmentTextActive: {
    fontWeight: "700",
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayButtonDisabled: {
    opacity: 0.9,
  },
  dayLabelActive: {
    fontWeight: "700",
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  goalValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: "#F7FAFD",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  goalAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  goalActionPressed: {
    opacity: 0.7,
  },
  goalValueWrap: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  goalHintText: {
    textAlign: "center",
  },
  goalValue: {
    fontSize: 36,
    lineHeight: 42,
  },
  goalValueInput: {
    minWidth: 110,
    minHeight: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#D9E2EF",
    paddingHorizontal: spacing.md,
    textAlign: "center",
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  goalSubtext: {
    textAlign: "center",
  },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  unitChip: {
    borderRadius: radii.pill,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  unitChipActive: {
    backgroundColor: "#E8F0FF",
  },
  unitChipTextActive: {
    fontWeight: "700",
  },
  unitInput: {
    minHeight: 52,
    borderRadius: radii.xl,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#D9E2EF",
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  timeRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeLabelActive: {
    fontWeight: "700",
  },
  selectCard: {
    minHeight: 60,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.soft,
  },
  selectCardPressed: {
    opacity: 0.8,
  },
  selectLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E8F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metaCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: "space-between",
    ...shadows.soft,
  },
  metaEyebrow: {
    fontWeight: "700",
    fontSize: 11,
  },
  metaIcon: {
    alignSelf: "flex-end",
  },
  reminderList: {
    gap: spacing.sm,
  },
  reminderChip: {
    minHeight: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.soft,
  },
  addReminderButton: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D4DCE8",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  addReminderButtonPressed: {
    opacity: 0.75,
  },
  errorText: {
    color: colors.danger,
  },
  deleteButton: {
    minHeight: 56,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF6F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
  deleteText: {
    color: colors.danger,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },
  categoryModalSheet: {
    marginTop: "auto",
    maxHeight: "72%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  modalGrabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: "#D6DFEA",
  },
  modalTitle: {
    textAlign: "center",
  },
  categoryList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryOption: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  categoryOptionActive: {
    backgroundColor: "#F8FBFF",
    borderColor: "#BFDBFE",
  },
  categoryCopy: {
    flex: 1,
    gap: 2,
  },
});
