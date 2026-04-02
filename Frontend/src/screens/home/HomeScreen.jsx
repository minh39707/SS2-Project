import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import EmptyStateCard from "@/src/components/EmptyStateCard";
import ScreenContainer from "@/src/components/ScreenContainer";
import SecondaryButton from "@/src/components/SecondaryButton";
import Card from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import { getDashboardData } from "@/src/services/habit.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import {
  formatTimeLabel,
  getFrequencyLabel,
  getLifeAreaLabel,
} from "@/src/utils/onboarding";

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
  if (frequency === "specific_days" || frequency === "weekly") {
    return new Set(specificDays);
  }

  if (frequency === "weekdays") {
    return new Set(["mon", "tue", "wed", "thu", "fri"]);
  }

  if (frequency === "weekends") {
    return new Set(["sat", "sun"]);
  }

  if (frequency === "monthly") {
    return new Set();
  }

  return new Set(orderedDays);
}

function getDashboardFrequencyLabel(frequency, specificDays) {
  if (frequency === "weekly") {
    if (!specificDays.length) {
      return "Weekly";
    }

    const labels = specificDays
      .map((day) => dayLabels[day] ?? day)
      .join(", ");

    return `Weekly: ${labels}`;
  }

  if (frequency === "monthly") {
    return "Monthly";
  }

  if (frequency === "daily") {
    return "Daily";
  }

  return null;
}

function getTodayKey() {
  const day = new Date().getDay();
  return orderedDays[(day + 6) % 7];
}

function getInitials(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "HH"
  );
}

function buildWeekEntries(calendarDays, activeDays, todayKey, streak) {
  const todayIndex = orderedDays.indexOf(todayKey);
  const entries = orderedDays.map((day, index) => {
    const calendarDay = calendarDays?.[index];
    let state = "inactive";

    if (calendarDay?.status === "done") {
      state = "done";
    } else if (day === todayKey) {
      state = "today";
    } else if (activeDays.has(day) && index < todayIndex) {
      state = "missed";
    } else if (activeDays.has(day)) {
      state = "planned";
    }

    return {
      key: day,
      label: dayLabels[day][0],
      fullLabel: dayLabels[day],
      state,
    };
  });

  const streakKeys = new Set();
  let remainingStreak = Math.max(0, streak);

  for (let index = todayIndex; index >= 0 && remainingStreak > 0; index -= 1) {
    if (entries[index].state === "done" || entries[index].state === "today") {
      streakKeys.add(entries[index].key);
      remainingStreak -= 1;
      continue;
    }

    if (entries[index].state === "missed") {
      break;
    }
  }

  return entries.map((entry) => ({
    ...entry,
    streak: streakKeys.has(entry.key),
  }));
}

function getMissionRoute(router, missionId) {
  if (missionId === "empty-first-habit" || missionId === "primary") {
    router.push("/habit-manage");
    return;
  }

  router.push({
    pathname: "/habit-edit",
    params: { habitId: missionId },
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
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
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!completed) {
      setIsLoading(false);
      return;
    }

    if (!isFocused) {
      return;
    }

    const fetchDashboard = async () => {
      if (!hasLoadedDashboard) {
        setIsLoading(true);
      }

      try {
        const result = await getDashboardData();
        setDashboardData(result);
        setHasLoadedDashboard(true);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDashboard();
  }, [completed, hasLoadedDashboard, hydrated, isFocused]);

  if (!hydrated || (completed && isLoading && !dashboardData)) {
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

  const primaryAction = dashboardData?.quickActions?.[0];
  const hasAnyHabits = !!primaryAction || data.habit_name;
  const dashboardFrequencyType = primaryAction?.frequencyType ?? null;
  const dashboardFrequencyDays = primaryAction?.frequencyDays ?? [];
  const lifeAreaLabel = data.life_area
    ? getLifeAreaLabel(data.life_area)
    : "General";
  const rawTimePeriod = data.time_period || "morning";
  const rawTimeExact = data.time_exact || "07:00";
  const scheduleLabel = primaryAction
    ? primaryAction.description
    : `${rawTimePeriod[0].toUpperCase()}${rawTimePeriod.slice(1)} at ${formatTimeLabel(rawTimeExact)}`;
  const frequencyLabel =
    getDashboardFrequencyLabel(dashboardFrequencyType, dashboardFrequencyDays) ??
    (data.frequency
      ? getFrequencyLabel(data.frequency, data.specific_days || [])
      : "Every day");
  const activeDays = getActiveDays(
    dashboardFrequencyType || data.frequency || "everyday",
    dashboardFrequencyType ? dashboardFrequencyDays : data.specific_days || [],
  );
  const todayKey = getTodayKey();
  const weekEntries = buildWeekEntries(
    dashboardData?.calendarDays ?? [],
    activeDays,
    todayKey,
    dashboardData?.stats?.find((item) => item.label === "Streaks")?.value ?? 0,
  );

  const hp = dashboardData?.stats?.find((item) => item.label === "HP")?.value ?? 50;
  const streak =
    dashboardData?.stats?.find((item) => item.label === "Streaks")?.value ?? 0;
  const exp = dashboardData?.stats?.find((item) => item.label === "EXP")?.value ?? 0;
  const level = Math.max(1, Math.floor(exp / 100) + 1);
  const expGoal = level * 100;
  const nextLevelRemaining = Math.max(expGoal - exp, 0);
  const expProgress = expGoal > 0 ? Math.max(0, Math.min(1, exp / expGoal)) : 0;
  const hpProgress = Math.max(0, Math.min(1, hp / 100));
  const todayProgressRatio = dashboardData?.todayProgress ?? 0;
  const trackedMissionCount = Math.max(1, hasAnyHabits ? Math.min(4, (dashboardData?.quickActions?.length ?? 1)) : 1);
  const completedMissionCount = Math.min(
    trackedMissionCount,
    Math.round(todayProgressRatio * trackedMissionCount),
  );
  const profileName = userProfile?.name ?? "Habit Hero";
  const profileInitials = getInitials(profileName);
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
      reward: action.id === primaryAction?.id ? "+20 EXP" : "+10 EXP",
      actionLabel: action.id === primaryAction?.id ? "Open mission" : "Open",
    })) ?? [];

  if (!hasAnyHabits) {
    missionItems = [
      {
        id: "empty-first-habit",
        icon: "add-circle-outline",
        title: "Create your first habit",
        caption: 'Use the "Add Habit" button below to start your streak.',
        reward: "+20 EXP",
        actionLabel: "Add habit",
      },
    ];
  }

  const primaryMission = missionItems[0];
  const habitListItems = missionItems.slice(0, 4);

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.sectionBlock}>
        <Card style={styles.playerCard}>
          <View style={styles.playerTop}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText} variant="subtitle">
                  {profileInitials}
                </Text>
              </View>
              <View style={styles.levelPill}>
                <Text color="primary" style={styles.levelPillText} variant="caption">
                  LV {level}
                </Text>
              </View>
            </View>

            <View style={styles.playerInfo}>
              <View style={styles.playerHeader}>
                <View style={styles.playerHeaderCopy}>
                  <Text style={styles.playerName} variant="subtitle">
                    {profileName}
                  </Text>
                  <Text color="muted" variant="caption">
                    {providerLabel}
                  </Text>
                </View>

                <View style={styles.streakBadge}>
                  <Text style={styles.streakText} variant="label">
                    {streak}
                  </Text>
                  <Ionicons color="#F59E0B" name="flame" size={14} />
                </View>
              </View>

              <View style={styles.statGroup}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel} variant="caption">
                    HP
                  </Text>
                  <Text style={styles.statValue} variant="caption">
                    {hp}/100
                  </Text>
                </View>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      styles.hpFill,
                      { width: `${Math.max(8, hpProgress * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.statGroup}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel} variant="caption">
                    EXP
                  </Text>
                  <Text style={styles.statValue} variant="caption">
                    {exp}/{expGoal}
                  </Text>
                </View>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      styles.expFill,
                      { width: `${Math.max(8, expProgress * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.playerHint}>
                <Ionicons color={colors.primary} name="flash-outline" size={14} />
                <Text color="muted" style={styles.playerHintText} variant="caption">
                  Complete habits to gain EXP. Missing core habits may cost HP.
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(430).delay(30)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <Text variant="subtitle">Week Tracker</Text>
          <Text color="muted" variant="body">
            {completedMissionCount}/{trackedMissionCount} done today
          </Text>
        </View>

        <Card style={styles.weekCard}>
          <View style={styles.weekRow}>
            {weekEntries.map((day) => (
              <View
                key={day.key}
                style={[
                  styles.weekDay,
                  day.state === "done" && styles.weekDayDone,
                  day.state === "missed" && styles.weekDayMissed,
                  day.state === "today" && styles.weekDayToday,
                  day.state === "planned" && styles.weekDayPlanned,
                ]}
              >
                {day.streak ? (
                  <View style={styles.flameBadge}>
                    <Ionicons color="#F59E0B" name="flame" size={10} />
                  </View>
                ) : null}

                {day.state === "done" ? (
                  <Ionicons color="#FFFFFF" name="checkmark" size={14} />
                ) : day.state === "missed" ? (
                  <Ionicons color="#E85D75" name="close" size={14} />
                ) : day.state === "today" ? (
                  <View style={styles.todayDot} />
                ) : null}

                <Text
                  style={[
                    styles.weekDayLabel,
                    day.state === "done" && styles.weekDayLabelDone,
                    day.state === "today" && styles.weekDayLabelToday,
                  ]}
                  variant="caption"
                >
                  {day.label}
                </Text>
              </View>
            ))}
          </View>

          <Text color="muted" variant="caption">
            Check marks show completed days, red marks show missed active days, and the flame highlights your current streak.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(470).delay(60)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <Text variant="subtitle">Your Habits</Text>
          <Text color="muted" variant="body">
            Quick access for today
          </Text>
        </View>

        {habitListItems.length > 0 ? (
          <View style={styles.questList}>
            {habitListItems.map((mission) => (
              <Pressable
                key={mission.id}
                onPress={() => getMissionRoute(router, mission.id)}
                style={({ pressed }) => [
                  styles.questPressable,
                  pressed && styles.questPressablePressed,
                ]}
              >
                <Card style={styles.questCard}>
                  <View style={styles.questIconWrap}>
                    <Ionicons
                      color={colors.primary}
                      name={mission.icon}
                      size={18}
                    />
                  </View>
                  <View style={styles.questCopy}>
                    <Text variant="subtitle">{mission.title}</Text>
                    <Text color="muted" variant="body">
                      {mission.caption}
                    </Text>
                  </View>
                  <View style={styles.questReward}>
                    <Text color="primary" variant="caption">
                      {mission.reward}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card style={styles.emptyQuestCard}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
            <Text variant="body">Add more habits to build a fuller mission board.</Text>
          </Card>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(510).delay(90)}
        style={styles.rewardRow}
      >
        <Card style={styles.rewardCard}>
          <View style={styles.rewardIconWrap}>
            <Ionicons color={colors.warning} name="gift-outline" size={18} />
          </View>
          <View style={styles.rewardCopy}>
            <Text color="muted" variant="caption">
              Daily Reward
            </Text>
            <Text variant="subtitle">Finish 1 mission for +20 EXP</Text>
          </View>
        </Card>

        <Card style={styles.rewardCard}>
          <View style={styles.rewardIconWrap}>
            <Ionicons color={colors.primary} name="trending-up-outline" size={18} />
          </View>
          <View style={styles.rewardCopy}>
            <Text color="muted" variant="caption">
              Next Level
            </Text>
            <Text variant="subtitle">{nextLevelRemaining} EXP remaining</Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(550).delay(120)}
        style={styles.sectionBlock}
      >
        <Card style={styles.todayMissionCard}>
          <View style={styles.todayMissionHeader}>
            <View>
              <Text color="primary" variant="label">
                Today&apos;s Mission
              </Text>
              <Text style={styles.todayMissionTitle} variant="title">
                {primaryMission?.title ?? "Create your first habit"}
              </Text>
            </View>
            <View style={styles.rewardBadge}>
              <Ionicons color={colors.warning} name="flash" size={14} />
              <Text style={styles.rewardBadgeText} variant="caption">
                {primaryMission?.reward ?? "+20 EXP"}
              </Text>
            </View>
          </View>

          <Text color="muted" style={styles.todayMissionBody} variant="body">
            {hasAnyHabits
              ? `${scheduleLabel}. ${frequencyLabel}. Keep ${lifeAreaLabel} moving forward.`
              : "Start with one real-world habit like drinking water, walking after lunch, or reading 15 pages."}
          </Text>

          <View style={styles.missionInfoRow}>
            <View style={styles.missionInfoChip}>
              <Ionicons color="#64748B" name="time-outline" size={14} />
              <Text color="muted" variant="caption">
                {scheduleLabel}
              </Text>
            </View>

            <View style={styles.missionInfoChip}>
              <Ionicons color="#64748B" name="pulse-outline" size={14} />
              <Text color="muted" variant="caption">
                {frequencyLabel}
              </Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() =>
                primaryMission
                  ? getMissionRoute(router, primaryMission.id)
                  : router.push("/habit-create")
              }
              style={({ pressed }) => [
                styles.primaryCta,
                pressed && styles.primaryCtaPressed,
              ]}
            >
              <Ionicons color={colors.surface} name="checkmark-circle" size={18} />
              <Text color="white" style={styles.primaryCtaText} variant="label">
                {primaryMission?.actionLabel ?? "Open mission"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/habit-create")}
              style={({ pressed }) => [
                styles.secondaryCta,
                pressed && styles.secondaryCtaPressed,
              ]}
            >
              <Ionicons color={colors.primary} name="add-circle-outline" size={18} />
              <Text color="primary" style={styles.secondaryCtaText} variant="label">
                Add Habit
              </Text>
            </Pressable>
          </View>
        </Card>
      </Animated.View>

      <View style={styles.actions}>
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
    paddingBottom: spacing.xxl * 2,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  playerCard: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
    borderRadius: 24,
  },
  playerTop: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  avatarWrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#D9E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
  },
  levelPillText: {
    fontWeight: "700",
  },
  playerInfo: {
    flex: 1,
    gap: 8,
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    alignItems: "center",
  },
  playerHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontSize: 18,
    lineHeight: 22,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE29A",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  streakText: {
    color: "#8A5400",
    fontWeight: "700",
  },
  statGroup: {
    gap: 3,
  },
  statLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statLabel: {
    color: "#475569",
    fontWeight: "700",
  },
  statValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  statTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "#DCE7F8",
    overflow: "hidden",
  },
  statFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  hpFill: {
    backgroundColor: "#EF5B64",
  },
  expFill: {
    backgroundColor: "#467EE8",
  },
  playerHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  playerHintText: {
    flex: 1,
    lineHeight: 17,
  },
  rewardRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rewardCard: {
    flex: 1,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rewardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFD",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardCopy: {
    flex: 1,
    gap: 2,
  },
  todayMissionCard: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: 28,
  },
  todayMissionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  todayMissionTitle: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: "#FFF4DE",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rewardBadgeText: {
    color: "#A16207",
    fontWeight: "700",
  },
  todayMissionBody: {
    lineHeight: 22,
  },
  missionInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  missionInfoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFD",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryCta: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  primaryCtaPressed: {
    opacity: 0.92,
  },
  primaryCtaText: {
    fontWeight: "700",
  },
  secondaryCta: {
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
  secondaryCtaPressed: {
    opacity: 0.85,
  },
  secondaryCtaText: {
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  weekCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  weekDay: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  weekDayDone: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  weekDayMissed: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FBCBD3",
  },
  weekDayToday: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekDayPlanned: {
    backgroundColor: "#EDF4FF",
    borderColor: "#CFE0FF",
  },
  weekDayLabel: {
    color: "#64748B",
    fontWeight: "700",
  },
  weekDayLabelDone: {
    color: "#FFFFFF",
  },
  weekDayLabelToday: {
    color: colors.primary,
  },
  flameBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF4DE",
    alignItems: "center",
    justifyContent: "center",
  },
  todayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  questList: {
    gap: spacing.sm,
  },
  questPressable: {
    borderRadius: radii.xl,
  },
  questPressablePressed: {
    opacity: 0.86,
  },
  questCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  questIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  questCopy: {
    flex: 1,
    gap: 2,
  },
  questReward: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D6E2F6",
  },
  emptyQuestCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actions: {
    marginTop: spacing.sm,
  },
});
