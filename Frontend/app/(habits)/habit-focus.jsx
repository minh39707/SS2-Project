import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import ScreenContainer from "@/src/components/ui/ScreenContainer";
import Card from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import { completeHabit, getHabitById } from "@/src/services/habit.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import {
  convertHabitTargetToSeconds,
  formatCountdown,
  formatFocusDuration,
  isTimeBasedHabitUnit,
} from "@/src/utils/habitTimer";

function getParamValue(param) {
  return Array.isArray(param) ? param[0] : param;
}

export default function HabitFocusScreen() {
  const router = useRouter();
  const { userProfile } = useOnboarding();
  const params = useLocalSearchParams();
  const habitId = getParamValue(params.habitId);
  const [habit, setHabit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const timerRef = useRef(null);
  const didAutoCompleteRef = useRef(false);
  const totalSeconds = useMemo(
    () => convertHabitTargetToSeconds(habit?.targetValue, habit?.targetUnit),
    [habit?.targetUnit, habit?.targetValue],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!habitId || !userProfile?.id) {
      setIsLoading(false);
      setError("Missing habit information.");
      return;
    }

    let isMounted = true;

    const loadHabit = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getHabitById(habitId, userProfile, {
          forceRefresh: true,
        });
        const nextHabit = response?.habit ?? null;

        if (!nextHabit || !isMounted) {
          return;
        }

        if (!isTimeBasedHabitUnit(nextHabit.targetUnit)) {
          throw new Error("This habit does not use a time-based goal.");
        }

        setHabit(nextHabit);
        setRemainingSeconds(
          convertHabitTargetToSeconds(nextHabit.targetValue, nextHabit.targetUnit),
        );
        setIsRunning(true);
        didAutoCompleteRef.current = false;
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this focus session.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHabit();

    return () => {
      isMounted = false;
    };
  }, [habitId, userProfile]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((currentSeconds) =>
        currentSeconds > 0 ? currentSeconds - 1 : 0,
      );
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, remainingSeconds]);

  const handleFinishSession = useCallback(async () => {
    if (!habit?.id || isCompleting) {
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      await completeHabit(habit.id, userProfile);
      Alert.alert(
        "Session complete",
        "Great work. Your habit was marked as completed.",
        [
          {
            text: "Back",
            onPress: () => {
              router.back();
            },
          },
        ],
      );
    } catch (completeError) {
      didAutoCompleteRef.current = false;
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Unable to complete this habit right now.",
      );
    } finally {
      setIsCompleting(false);
    }
  }, [habit?.id, isCompleting, router, userProfile]);

  useEffect(() => {
    if (
      remainingSeconds !== 0 ||
      !isRunning ||
      !habit ||
      didAutoCompleteRef.current
    ) {
      return;
    }

    didAutoCompleteRef.current = true;
    setIsRunning(false);
    void handleFinishSession();
  }, [habit, handleFinishSession, isRunning, remainingSeconds]);

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    didAutoCompleteRef.current = false;
    setError(null);
  };

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!habit) {
    return (
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

          <View style={styles.headerCopy}>
            <Text variant="title">Focus Mode</Text>
            <Text color="muted" variant="body">
              The timer could not be started for this habit.
            </Text>
          </View>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.warning} name="alert-circle-outline" size={24} />
          </View>
          <Text style={styles.heroTitle} variant="subtitle">
            Focus session unavailable
          </Text>
          <Text color="muted" style={styles.heroSubtitle} variant="body">
            {error ?? "This habit is missing time-based settings."}
          </Text>
        </Card>
      </ScreenContainer>
    );
  }

  return (
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

        <View style={styles.headerCopy}>
          <Text variant="title">Focus Mode</Text>
          <Text color="muted" variant="body">
            Finish the countdown to complete this habit.
          </Text>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons color={colors.primary} name="timer-outline" size={24} />
        </View>

        <Text style={styles.heroTitle} variant="title">
          {habit?.title ?? "Focus Habit"}
        </Text>
        <Text color="muted" style={styles.heroSubtitle} variant="body">
          Goal: {formatFocusDuration(habit?.targetValue, habit?.targetUnit)}
        </Text>

        <View style={styles.timerRing}>
          <Text style={styles.timerText} variant="title">
            {formatCountdown(remainingSeconds)}
          </Text>
        </View>

        <Text color="muted" style={styles.timerHint} variant="caption">
          {remainingSeconds > 0
            ? "Stay with the task until the timer ends."
            : "Countdown finished. Wrapping up your habit now."}
        </Text>
      </Card>

      {error ? (
        <Text style={styles.errorText} variant="caption">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          disabled={isCompleting || remainingSeconds === 0}
          onPress={() => setIsRunning((currentValue) => !currentValue)}
          style={({ pressed }) => [
            styles.primaryButton,
            (isCompleting || remainingSeconds === 0) && styles.primaryButtonDisabled,
            pressed && !isCompleting && styles.primaryButtonPressed,
          ]}
        >
          <Ionicons
            color="#FFFFFF"
            name={isRunning ? "pause" : "play"}
            size={18}
          />
          <Text color="white" style={styles.primaryButtonText} variant="label">
            {isRunning ? "Pause" : "Resume focus"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isCompleting}
          onPress={handleReset}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isCompleting && styles.secondaryButtonPressed,
          ]}
        >
          <Ionicons color={colors.primary} name="refresh-outline" size={18} />
          <Text color="primary" style={styles.secondaryButtonText} variant="label">
            Reset
          </Text>
        </Pressable>
      </View>

      <Pressable
        disabled={isCompleting || remainingSeconds > 0}
        onPress={() => void handleFinishSession()}
        style={({ pressed }) => [
          styles.finishButton,
          (isCompleting || remainingSeconds > 0) && styles.finishButtonDisabled,
          pressed &&
            !isCompleting &&
            remainingSeconds === 0 &&
            styles.finishButtonPressed,
        ]}
      >
        {isCompleting ? (
          <ActivityIndicator color={colors.surface} size="small" />
        ) : (
          <>
            <Ionicons color={colors.surface} name="checkmark-circle" size={18} />
            <Text color="white" style={styles.finishButtonText} variant="label">
              Complete Habit
            </Text>
          </>
        )}
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
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
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    ...shadows.card,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 34,
  },
  heroSubtitle: {
    textAlign: "center",
  },
  timerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 10,
    borderColor: "#D7E5FB",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    fontSize: 42,
    lineHeight: 48,
    color: colors.primary,
  },
  timerHint: {
    textAlign: "center",
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    fontWeight: "700",
  },
  secondaryButton: {
    minWidth: 120,
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D6E2F6",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonPressed: {
    opacity: 0.82,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  finishButton: {
    minHeight: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  finishButtonDisabled: {
    opacity: 0.55,
  },
  finishButtonPressed: {
    opacity: 0.84,
  },
  finishButtonText: {
    fontWeight: "700",
  },
});
