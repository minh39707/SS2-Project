import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Card from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import EmptyStateCard from "@/src/components/EmptyStateCard";
import PrimaryButton from "@/src/components/PrimaryButton";
import ScreenContainer from "@/src/components/ScreenContainer";
import SecondaryButton from "@/src/components/SecondaryButton";
import { useOnboarding } from "@/src/store/OnboardingContext";
import {
  formatTimeLabel,
  getFrequencyLabel,
  getHabitDisplayName,
  getLifeAreaLabel,
} from "@/src/utils/onboarding";
import { useEffect, useState } from "react";
import { getDashboardData } from "@/src/services/habit.service";
const orderedDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayLabels = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
function getActiveDays(frequency, specificDays) {
  if (frequency === "specific_days") {
    return new Set(specificDays);
  }
  if (frequency === "weekdays") {
    return new Set(["mon", "tue", "wed", "thu", "fri"]);
  }
  if (frequency === "weekends") {
    return new Set(["sat", "sun"]);
  }
  return new Set(orderedDays);
}
function getTodayKey() {
  const day = new Date().getDay();
  return orderedDays[(day + 6) % 7];
}
export default function HomeScreen() {
  const router = useRouter();
  const {
    authMethod,
    completed,
    data,
    hydrated,
    resetOnboarding,
    userProfile,
  } = useOnboarding();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only fetch if hydrated and the user has completed login
    if (!hydrated || !completed) return;

    const fetchDashboard = async () => {
      try {
        const result = await getDashboardData();
        setDashboardData(result);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [hydrated, completed]);

  if (!hydrated || (completed && isLoading)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!completed) {
    return (
      <ScreenContainer contentContainerStyle={styles.emptyWrap}>
        <EmptyStateCard
          actionLabel="Continue to Login"
          description="Login or create an account to enter the dashboard."
          onAction={() => router.replace("/welcome")}
          title="Dashboard locked"
        />
      </ScreenContainer>
    );
  }

  // Determine primary habit from dashboardData if available, fallback to local data if not
  // (useful for immediate feedback before refresh)
  const primaryAction = dashboardData?.quickActions?.[0];
  const hasAnyHabits = !!primaryAction || data.habit_name;

  const habitLabel = primaryAction
    ? primaryAction.title
    : data.habit_name
      ? getHabitDisplayName(data.habit_name, data.habit_type)
      : "No Focus";
  const lifeAreaLabel = data.life_area
    ? getLifeAreaLabel(data.life_area)
    : "General";
  const rawTimePeriod = data.time_period || "morning";
  const rawTimeExact = data.time_exact || "07:00";
  const scheduleLabel = primaryAction
    ? primaryAction.description
    : `${rawTimePeriod[0].toUpperCase()}${rawTimePeriod.slice(1)} at ${formatTimeLabel(rawTimeExact)}`;
  const frequencyLabel = data.frequency
    ? getFrequencyLabel(data.frequency, data.specific_days || [])
    : "everyday";
  const activeDays = getActiveDays(
    data.frequency || "everyday",
    data.specific_days || [],
  );
  const todayKey = getTodayKey();

  // Stats from dashboard data
  const hp = dashboardData?.stats?.find((s) => s.label === "HP")?.value ?? 50;
  const streak =
    dashboardData?.stats?.find((s) => s.label === "Streaks")?.value ?? 0;
  const exp = dashboardData?.stats?.find((s) => s.label === "EXP")?.value ?? 0;
  const level = Math.max(1, Math.floor(exp / 100) + 1); // Default simplified level logic
  const expGoal = level * 100;
  const expProgress = (exp % 100) / 100;

  const profileName = userProfile?.name ?? "Habit Hero";
  const providerLabel =
    authMethod === "google"
      ? "Google sync"
      : authMethod === "facebook"
        ? "Facebook sync"
        : authMethod === "github"
          ? "GitHub sync"
          : authMethod === "email"
            ? "Email account"
            : "Guest mode";

  let missionItems =
    dashboardData?.quickActions?.map((action) => ({
      id: action.id,
      icon:
        action.icon === "water"
          ? "water-outline"
          : action.icon === "run"
            ? "walk-outline"
            : "sparkles-outline",
      title: action.title,
      caption: action.description,
      done: false,
    })) ?? [];

  if (!hasAnyHabits) {
    missionItems = [
      {
        id: "empty-first-habit",
        icon: "add-circle-outline",
        title: "Add your first habit",
        caption: 'Tap "Adjust My Habit" below to get started',
        done: false,
      },
    ];
  }
  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={styles.heroWrap}
      >
        <LinearGradient
          colors={["#307AF3", "#1E5ED8"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View>
              <Text color="white" style={styles.heroEyebrow} variant="label">
                HabitForge Dashboard
              </Text>
              <Text color="white" style={styles.heroName} variant="title">
                {profileName}
              </Text>
              <Text color="white" style={styles.heroSubtext} variant="body">
                {habitLabel} is your focus today.
              </Text>
            </View>

            <View style={styles.levelBadge}>
              <Text style={styles.levelText} variant="label">
                LV {level}
              </Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStatCard}>
              <Text
                color="white"
                style={styles.heroStatLabel}
                variant="caption"
              >
                HP
              </Text>
              <Text
                color="white"
                style={styles.heroStatValue}
                variant="subtitle"
              >
                {hp}/100
              </Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text
                color="white"
                style={styles.heroStatLabel}
                variant="caption"
              >
                Streaks
              </Text>
              <Text
                color="white"
                style={styles.heroStatValue}
                variant="subtitle"
              >
                {streak} days
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(470).delay(40)}
        style={styles.expCardWrap}
      >
        <Card style={styles.expCard}>
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">EXP Progress</Text>
            <Text color="muted" variant="body">
              {exp}/{expGoal}
            </Text>
          </View>
          <View style={styles.expTrack}>
            <View
              style={[
                styles.expFill,
                { width: `${Math.max(12, expProgress * 100)}%` },
              ]}
            />
          </View>
          <Text color="muted" variant="body">
            Keep checking in on time to level up faster.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(520).delay(80)}
        style={styles.statsGrid}
      >
        <Card style={styles.statCard}>
          <Ionicons color={colors.primary} name="person-outline" size={20} />
          <Text color="muted" variant="caption">
            Account
          </Text>
          <Text variant="subtitle">{providerLabel}</Text>
        </Card>

        <Card style={styles.statCard}>
          <Ionicons color={colors.primary} name="calendar-outline" size={20} />
          <Text color="muted" variant="caption">
            Schedule
          </Text>
          <Text variant="subtitle">{scheduleLabel}</Text>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(560).delay(110)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <Text variant="subtitle">Week</Text>
          <Text color="muted" variant="body">
            Active days
          </Text>
        </View>

        <View style={styles.weekRow}>
          {orderedDays.map((day) => {
            const isToday = day === todayKey;
            const isActive = activeDays.has(day);
            return (
              <View
                key={day}
                style={[
                  styles.dayPill,
                  isActive && styles.dayPillActive,
                  isToday && styles.dayPillToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    isActive && styles.dayLabelActive,
                    isToday && styles.dayLabelToday,
                  ]}
                  variant="caption"
                >
                  {dayLabels[day]}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(600).delay(140)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <Text variant="subtitle">Mission Board</Text>
          <Text color="muted" variant="body">
            3 quests today
          </Text>
        </View>

        <View style={styles.missionList}>
          {missionItems.map((mission, index) => (
            <Card
              key={mission.id ?? `${mission.title}-${index}`}
              style={styles.missionCard}
            >
              <View
                style={[
                  styles.missionIcon,
                  mission.done && styles.missionIconDone,
                ]}
              >
                <Ionicons
                  color={mission.done ? "#0F9F6E" : colors.primary}
                  name={mission.icon}
                  size={18}
                />
              </View>
              <View style={styles.missionCopy}>
                <Text variant="subtitle">{mission.title}</Text>
                <Text color="muted" variant="body">
                  {mission.caption}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(640).delay(170)}
        style={styles.sectionBlock}
      >
        <Card style={styles.focusCard}>
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Today&apos;s Focus</Text>
            <Text color="primary" variant="label">
              {lifeAreaLabel}
            </Text>
          </View>

          <Text style={styles.focusHabit} variant="title">
            {habitLabel}
          </Text>
          <Text color="muted" variant="body">
            {scheduleLabel}
          </Text>
          <Text color="muted" variant="body">
            {frequencyLabel}
          </Text>
        </Card>
      </Animated.View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Adjust My Habit"
          onPress={() => router.replace("/schedule")}
        />
        <SecondaryButton
          label="Start over"
          onPress={() => {
            void resetOnboarding();
            router.replace("/welcome");
          }}
        />
      </View>
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
  emptyWrap: {
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl + spacing.md,
  },
  heroWrap: {
    marginTop: spacing.xs,
  },
  hero: {
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroEyebrow: {
    opacity: 0.8,
    marginBottom: 6,
  },
  heroName: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 6,
  },
  heroSubtext: {
    opacity: 0.92,
    maxWidth: 220,
  },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  levelText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroStatLabel: {
    opacity: 0.8,
    marginBottom: 8,
  },
  heroStatValue: {
    fontSize: 20,
    lineHeight: 24,
  },
  expCardWrap: {
    marginTop: -4,
  },
  expCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  expTrack: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: "#E7EFFB",
    overflow: "hidden",
  },
  expFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F1F5FB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3EAF5",
  },
  dayPillActive: {
    backgroundColor: "#E8F1FF",
    borderColor: "#BFD6FF",
  },
  dayPillToday: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayLabel: {
    color: "#74839D",
  },
  dayLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  dayLabelToday: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  missionList: {
    gap: spacing.sm,
  },
  missionCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  missionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  missionIconDone: {
    backgroundColor: "#EAF9F2",
  },
  missionCopy: {
    flex: 1,
    gap: 2,
  },
  focusCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  focusHabit: {
    fontSize: 28,
    lineHeight: 34,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
