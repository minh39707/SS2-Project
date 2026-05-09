import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import EmptyStateCard from "@/src/components/ui/EmptyStateCard";
import ScreenContainer from "@/src/components/ui/ScreenContainer";
import SecondaryButton from "@/src/components/ui/SecondaryButton";
import Card from "@/src/components/ui/Card";
import ProfileAvatar from "@/src/components/ui/ProfileAvatar";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import {
  clearHabitStatus,
  completeHabit,
  getDashboardData,
  setHabitStatus,
  uncompleteHabit,
} from "@/src/services/habit.service";
import {
  abandonQuest,
  acceptQuest,
  generateAiQuest,
  getAvailableQuests,
  getMyQuests,
  logQuestProgress,
} from "@/src/services/quest.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import {
  formatTimeLabel,
  getFrequencyLabel,
  getLifeAreaLabel,
} from "@/src/utils/onboarding";
import {
  getHabitActionIcon,
  getHabitActionLabel,
  openHabitFocusRoute,
  shouldOpenHabitFocus,
} from "@/src/utils/habitActions";
import {
  getBadHabitStatusLabelVi,
  getHabitTodayStatus,
  isNegativeHabit,
} from "@/src/utils/habitStatus";
import { resolveHabitTargetUnit } from "@/src/utils/habitTimer";

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

function getGoldPerTaskPreview(level = 1) {
  return Math.min(10, 1 + Math.floor(Math.max(1, level) / 10));
}

function getDailyStreakGoldPreview(streak = 0) {
  return Math.min(Math.max(0, streak), 50);
}

function buildCoinRewardPreview({
  mission,
  player,
  dailySummary,
}) {
  if (!mission || isNegativeHabit(mission)) {
    return {
      guaranteedGold: 0,
      estimatedGold: 0,
      taskGold: 0,
      streakGold: 0,
      levelUpGold: 0,
      dailyCompletionGold: 0,
      isEligibleToday: false,
      note: "Bad habits do not show a positive coin reward preview.",
    };
  }

  if (!mission.isScheduledToday) {
    return {
      guaranteedGold: 0,
      estimatedGold: 0,
      taskGold: 0,
      streakGold: 0,
      levelUpGold: 0,
      dailyCompletionGold: 0,
      isEligibleToday: false,
      note: "This habit is not scheduled for today, so it would not award coins right now.",
    };
  }

  const level = player?.level ?? 1;
  const currentExp = player?.currentExp ?? 0;
  const expToNextLevel = Math.max(1, player?.expToNextLevel ?? 100);
  const streak = player?.streak ?? 0;
  const taskGold = getGoldPerTaskPreview(level);
  const completedCount = Number(dailySummary?.completedCount ?? 0);
  const totalCount = Number(dailySummary?.totalCount ?? 0);
  const willCompleteToday = !mission.completedToday && totalCount > 0 && completedCount + 1 >= totalCount;
  const streakGold = mission.completedToday || completedCount > 0 ? 0 : getDailyStreakGoldPreview(streak);
  const projectedExp = currentExp + Number(mission.expReward ?? 0);
  const levelUps = mission.completedToday ? 0 : Math.floor(projectedExp / expToNextLevel);
  const levelUpGold = Math.max(0, levelUps) * 10;
  const dailyCompletionGold = willCompleteToday ? 10 : 0;
  const estimatedGold = mission.completedToday
    ? taskGold
    : taskGold + streakGold + levelUpGold + dailyCompletionGold;

  return {
    guaranteedGold: taskGold,
    estimatedGold,
    taskGold,
    streakGold,
    levelUpGold,
    dailyCompletionGold,
    isEligibleToday: true,
    note: mission.completedToday
      ? "This habit is already completed today. The exact coin reward may have depended on completion order."
      : "Estimated with your current dashboard state. The final coin gain can change if another habit is completed first.",
  };
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

function sortDashboardHabits(habits = []) {
  return [...habits].sort((leftHabit, rightHabit) => {
    const leftRank =
      (leftHabit.isScheduledToday ? 0 : 2) + (leftHabit.completedToday ? 1 : 0);
    const rightRank =
      (rightHabit.isScheduledToday ? 0 : 2) + (rightHabit.completedToday ? 1 : 0);

    return leftRank - rightRank;
  });
}

function mergeDashboardHabit(existingHabit, updatedHabit) {
  if (!existingHabit || existingHabit.id !== updatedHabit.id) {
    return existingHabit;
  }

  return {
    ...existingHabit,
    title: updatedHabit.title ?? existingHabit.title,
    habitType: updatedHabit.habitType ?? existingHabit.habitType,
    targetValue: updatedHabit.targetValue ?? existingHabit.targetValue,
    targetUnit: updatedHabit.targetUnit ?? existingHabit.targetUnit,
    frequencyType: updatedHabit.frequencyType ?? existingHabit.frequencyType,
    frequencyDays: updatedHabit.frequencyDays ?? existingHabit.frequencyDays,
    completedToday: updatedHabit.completedToday ?? existingHabit.completedToday,
    loggedToday: updatedHabit.loggedToday ?? existingHabit.loggedToday,
    todayStatus: updatedHabit.todayStatus ?? existingHabit.todayStatus,
    currentStreak: updatedHabit.currentStreak ?? existingHabit.currentStreak,
    bestStreak: updatedHabit.bestStreak ?? existingHabit.bestStreak,
    isScheduledToday: updatedHabit.isScheduledToday ?? existingHabit.isScheduledToday,
    expReward: updatedHabit.expReward ?? existingHabit.expReward,
    streakBonusExp: updatedHabit.streakBonusExp ?? existingHabit.streakBonusExp,
  };
}

function updateTodayCalendarDay(calendarDays = [], hasCompletedPositiveHabitToday) {
  const todayIndex = (new Date().getDay() + 6) % 7;

  return calendarDays.map((day, index) => {
    if (index !== todayIndex) {
      return day;
    }

    return {
      ...day,
      status: hasCompletedPositiveHabitToday ? "done" : "warning",
      streak: hasCompletedPositiveHabitToday,
    };
  });
}

function applyHabitUpdateToDashboard(dashboard, updatedHabit) {
  if (!dashboard || !updatedHabit?.id) {
    return dashboard;
  }

  const quickActions = sortDashboardHabits(
    (dashboard.quickActions ?? []).map((habit) =>
      mergeDashboardHabit(habit, updatedHabit),
    ),
  );
  const goodHabits = (dashboard.goodHabits ?? []).map((habit) =>
    mergeDashboardHabit(habit, updatedHabit),
  );
  const badHabits = (dashboard.badHabits ?? []).map((habit) =>
    mergeDashboardHabit(habit, updatedHabit),
  );
  const positiveHabits =
    goodHabits.length > 0
      ? goodHabits
      : quickActions.filter((habit) => !isNegativeHabit(habit));
  const totalCount = positiveHabits.filter((habit) => habit.isScheduledToday).length;
  const completedCount = positiveHabits.filter(
    (habit) => habit.isScheduledToday && habit.completedToday,
  ).length;

  return {
    ...dashboard,
    quickActions,
    goodHabits,
    badHabits,
    todayProgress: totalCount > 0 ? completedCount / totalCount : 0,
    dailySummary: {
      ...(dashboard.dailySummary ?? {}),
      completedCount,
      totalCount,
    },
    calendarDays: updateTodayCalendarDay(
      dashboard.calendarDays ?? [],
      completedCount > 0,
    ),
  };
}

function getTodayKey() {
  const day = new Date().getDay();
  return orderedDays[(day + 6) % 7];
}

function buildWeekEntries(calendarDays, activeDays, todayKey) {
  const todayIndex = orderedDays.indexOf(todayKey);

  return orderedDays.map((day, index) => {
    const calendarDay = calendarDays?.[index];
    let state = "inactive";

    if (calendarDay?.status === "done") {
      state = "done";
    } else if (calendarDay?.status === "missed") {
      state = "missed";
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
      streak: !!calendarDay?.streak,
    };
  });
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

function buildAllHabitsPraiseMessage(totalCount) {
  if (totalCount <= 1) {
    return "Tuyet voi, ban da hoan thanh habit hom nay.";
  }

  return `Tuyet voi, ban da hoan thanh tat ca ${totalCount} habit hom nay.`;
}

function normalizeQuestCatalogueItem(quest) {
  return {
    id: quest.quest_id ?? quest.id,
    title: quest.title ?? "Untitled quest",
    description: quest.description ?? "",
    difficulty: quest.difficulty ?? "easy",
    expReward: quest.exp_reward ?? quest.expReward ?? 0,
    goldReward: quest.gold_reward ?? quest.goldReward ?? 0,
    hpReward: quest.hp_reward ?? quest.hpReward ?? 0,
    targetCount: quest.target_count ?? quest.targetCount ?? 1,
    icon: quest.icon ?? "flag-outline",
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const {
    authMethod,
    completed,
    data,
    hydrated,
    userProfile,
  } = useOnboarding();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingMission, setIsUpdatingMission] = useState(false);
  const [updatingHabitId, setUpdatingHabitId] = useState(null);
  const [missionError, setMissionError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [praiseMessage, setPraiseMessage] = useState(null);
  const [isGoodHabitsCollapsed, setIsGoodHabitsCollapsed] = useState(false);
  const [isBadHabitsCollapsed, setIsBadHabitsCollapsed] = useState(false);
  const [isQuestsCollapsed, setIsQuestsCollapsed] = useState(false);
  const [selectedCoinMission, setSelectedCoinMission] = useState(null);
  const [activeQuests, setActiveQuests] = useState([]);
  const [availableQuests, setAvailableQuests] = useState([]);
  const [questError, setQuestError] = useState(null);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isGeneratingAiQuest, setIsGeneratingAiQuest] = useState(false);
  const [updatingQuestId, setUpdatingQuestId] = useState(null);
  const hasLoadedDashboardRef = useRef(false);

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
      if (!hasLoadedDashboardRef.current) {
        setIsLoading(true);
      }

      try {
        const result = await getDashboardData();
        setDashboardData(result);
        hasLoadedDashboardRef.current = true;
        setMissionError(null);
        setLoadError(null);
      } catch (error) {
        console.error("Failed to load dashboard", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load your dashboard right now.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDashboard();
  }, [completed, hydrated, isFocused]);

  useEffect(() => {
    if (!hydrated || !completed || !isFocused) {
      return;
    }

    const fetchQuests = async () => {
      setIsLoadingQuests(true);

      try {
        const [myQuestResult, availableQuestResult] = await Promise.all([
          getMyQuests(),
          getAvailableQuests(),
        ]);

        setActiveQuests(myQuestResult?.quests ?? []);
        setAvailableQuests(
          (availableQuestResult?.quests ?? []).map(normalizeQuestCatalogueItem),
        );
        setQuestError(null);
      } catch (error) {
        console.error("Failed to load quests", error);
        setQuestError(
          error instanceof Error ? error.message : "Unable to load quests right now.",
        );
      } finally {
        setIsLoadingQuests(false);
      }
    };

    void fetchQuests();
  }, [completed, hydrated, isFocused]);

  useEffect(() => {
    if (!praiseMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setPraiseMessage(null);
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [praiseMessage]);

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
  );
  const player = dashboardData?.player ?? null;
  const hp =
    player?.currentHp ??
    dashboardData?.stats?.find((item) => item.label === "HP")?.value ??
    50;
  const hpMax =
    player?.maxHp ??
    dashboardData?.stats?.find((item) => item.label === "HP")?.max ??
    100;
  const streak =
    player?.streak ??
    dashboardData?.stats?.find((item) => item.label === "Streaks")?.value ??
    0;
  const goldCoins = player?.goldCoins ?? userProfile?.goldCoins ?? 0;
  const exp =
    player?.currentExp ??
    dashboardData?.stats?.find((item) => item.label === "EXP")?.value ??
    0;
  const level = player?.level ?? 1;
  const expGoal =
    player?.expToNextLevel ??
    dashboardData?.stats?.find((item) => item.label === "EXP")?.max ??
    100;
  const expProgress = expGoal > 0 ? Math.max(0, Math.min(1, exp / expGoal)) : 0;
  const hpProgress = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
  const todayProgressRatio = dashboardData?.todayProgress ?? 0;
  const trackedMissionCount = Math.max(
    1,
    dashboardData?.dailySummary?.totalCount ??
      (hasAnyHabits ? Math.max(1, dashboardData?.quickActions?.length ?? 1) : 1),
  );
  const completedMissionCount = Math.min(
    trackedMissionCount,
    dashboardData?.dailySummary?.completedCount ??
      Math.round(todayProgressRatio * trackedMissionCount),
  );
  const profileName = userProfile?.name ?? "Habit Hero";
  const profileAvatarUrl = userProfile?.avatarUrl ?? null;
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
  const dailySummary = dashboardData?.dailySummary ?? null;

  let missionItems =
    dashboardData?.quickActions?.map((action) => {
      const resolvedTargetUnit = resolveHabitTargetUnit(
        action.targetUnit,
        action.description,
      );

      return {
        id: action.id,
        icon:
          action.icon === "water"
            ? "water-outline"
            : action.icon === "run"
              ? "walk-outline"
              : "sparkles-outline",
        title: action.title,
        caption: action.description,
        reward: `+${action.expReward ?? 20} EXP`,
        habitType: action.habitType ?? "positive",
        completedToday: action.completedToday,
        loggedToday: action.loggedToday,
        todayStatus: action.todayStatus ?? null,
        isScheduledToday: action.isScheduledToday,
        currentStreak: action.currentStreak ?? 0,
        targetValue: action.targetValue ?? 1,
        targetUnit: resolvedTargetUnit,
      };
    }) ?? [];
  const mapDashboardHabitToMission = (action) => {
    const resolvedTargetUnit = resolveHabitTargetUnit(
      action.targetUnit,
      action.description,
    );

    return {
      id: action.id,
      icon:
        action.icon === "water"
          ? "water-outline"
          : action.icon === "run"
            ? "walk-outline"
            : "sparkles-outline",
      title: action.title,
      caption: action.description,
      reward: `+${action.expReward ?? 20} EXP`,
      habitType: action.habitType ?? "positive",
      completedToday: action.completedToday,
      loggedToday: action.loggedToday,
      todayStatus: action.todayStatus ?? null,
      isScheduledToday: action.isScheduledToday,
      currentStreak: action.currentStreak ?? 0,
      targetValue: action.targetValue ?? 1,
      targetUnit: resolvedTargetUnit,
    };
  };
  const goodHabitItems =
    dashboardData?.goodHabits?.map(mapDashboardHabitToMission) ?? [];
  const badHabitItems =
    dashboardData?.badHabits?.map(mapDashboardHabitToMission) ?? [];

  if (!hasAnyHabits) {
    missionItems = [
      {
        id: "empty-first-habit",
        icon: "add-circle-outline",
        title: "Create your first habit",
        caption: 'Use the "Add Habit" button below to start your streak.',
        reward: "+20 EXP",
      },
    ];
  }

  const primaryMission = missionItems[0];
  const primaryMissionCoinPreview = buildCoinRewardPreview({
    mission: primaryMission,
    player,
    dailySummary,
  });

  const refreshDashboard = async () => {
    const refreshedDashboard = await getDashboardData({ forceRefresh: true });
    setDashboardData(refreshedDashboard);
    return refreshedDashboard;
  };

  const syncDashboardInBackground = () => {
    void refreshDashboard().catch((error) => {
      console.warn("Failed to sync dashboard after updating a habit.", error);
    });
  };

  const applyHabitResponseToDashboard = (updatedHabit) => {
    if (!updatedHabit) {
      return null;
    }

    const nextDashboard = applyHabitUpdateToDashboard(dashboardData, updatedHabit);

    if (nextDashboard) {
      setDashboardData(nextDashboard);
    }

    return nextDashboard;
  };

  const showAllHabitsPraiseIfReady = (refreshedDashboard) => {
    const totalCount = Number(refreshedDashboard?.dailySummary?.totalCount ?? 0);
    const completedCount = Number(
      refreshedDashboard?.dailySummary?.completedCount ?? 0,
    );

    if (totalCount > 0 && completedCount >= totalCount) {
      setPraiseMessage(buildAllHabitsPraiseMessage(totalCount));
    }
  };

  const openCoinRules = (mission) => {
    setSelectedCoinMission(mission ?? null);
  };

  const closeCoinRules = () => {
    setSelectedCoinMission(null);
  };

  const selectedCoinBreakdown = selectedCoinMission
    ? buildCoinRewardPreview({
        mission: selectedCoinMission,
        player,
        dailySummary,
      })
    : null;

  const refreshQuests = async () => {
    const [myQuestResult, availableQuestResult] = await Promise.all([
      getMyQuests(),
      getAvailableQuests(),
    ]);

    setActiveQuests(myQuestResult?.quests ?? []);
    setAvailableQuests(
      (availableQuestResult?.quests ?? []).map(normalizeQuestCatalogueItem),
    );
    setQuestError(null);
  };

  const handleAcceptQuest = async (quest) => {
    if (!quest?.id || updatingQuestId) {
      return;
    }

    setUpdatingQuestId(quest.id);
    setQuestError(null);

    try {
      await acceptQuest(quest.id);
      await refreshQuests();
    } catch (error) {
      setQuestError(
        error instanceof Error ? error.message : "Unable to accept this quest.",
      );
    } finally {
      setUpdatingQuestId(null);
    }
  };

  const handleQuestProgress = async (quest) => {
    if (!quest?.userQuestId || updatingQuestId) {
      return;
    }

    setUpdatingQuestId(quest.userQuestId);
    setQuestError(null);

    try {
      const result = await logQuestProgress(quest.userQuestId);
      await refreshQuests();

      if (result?.completed) {
        await refreshDashboard();
      }
    } catch (error) {
      setQuestError(
        error instanceof Error ? error.message : "Unable to update this quest.",
      );
    } finally {
      setUpdatingQuestId(null);
    }
  };

  const handleAbandonQuest = (quest) => {
    if (!quest?.userQuestId || updatingQuestId) {
      return;
    }

    Alert.alert(
      "Abandon quest",
      `Abandon "${quest.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Abandon",
          style: "destructive",
          onPress: async () => {
            setUpdatingQuestId(quest.userQuestId);
            setQuestError(null);

            try {
              await abandonQuest(quest.userQuestId);
              await refreshQuests();
            } catch (error) {
              setQuestError(
                error instanceof Error
                  ? error.message
                  : "Unable to abandon this quest.",
              );
            } finally {
              setUpdatingQuestId(null);
            }
          },
        },
      ],
    );
  };

  const handleGenerateAiQuest = async () => {
    if (isGeneratingAiQuest || updatingQuestId) {
      return;
    }

    setIsGeneratingAiQuest(true);
    setQuestError(null);
    setIsQuestsCollapsed(false);

    try {
      const result = await generateAiQuest();
      await refreshQuests();
      Alert.alert(
        "AI Quest created",
        result?.quest?.title ? `"${result.quest.title}" is now active.` : "Your AI quest is now active.",
      );
    } catch (error) {
      setQuestError(
        error instanceof Error ? error.message : "Unable to generate an AI quest.",
      );
    } finally {
      setIsGeneratingAiQuest(false);
    }
  };

  const handleSetNegativeHabitStatus = async (habit, status) => {
    if (!habit?.id || isUpdatingMission || updatingHabitId === habit.id) {
      return;
    }

    setUpdatingHabitId(habit.id);
    setMissionError(null);

    try {
      const currentStatus = getHabitTodayStatus(habit);
      let response = null;

      if (currentStatus === status) {
        response = await clearHabitStatus(habit.id, userProfile);
      } else {
        response = await setHabitStatus(habit.id, status, userProfile);
      }

      const nextDashboard = applyHabitResponseToDashboard(response?.habit ?? null);
      if (currentStatus !== status && status === "avoided") {
        showAllHabitsPraiseIfReady(nextDashboard);
      }
      syncDashboardInBackground();
      setLoadError(null);
    } catch (error) {
      setMissionError(
        error instanceof Error
          ? error.message
          : "Unable to update this habit right now.",
      );
    } finally {
      setUpdatingHabitId(null);
    }
  };

  const handlePrimaryMission = async () => {
    if (isUpdatingMission) {
      return;
    }

    if (!primaryMission) {
      router.push("/habit-create");
      return;
    }

    if (primaryMission.id === "empty-first-habit") {
      router.push("/habit-create");
      return;
    }

    if (!primaryMission.isScheduledToday) {
      getMissionRoute(router, primaryMission.id);
      return;
    }

    if (shouldOpenHabitFocus(primaryMission)) {
      openHabitFocusRoute(router, primaryMission.id);
      return;
    }

    if (isNegativeHabit(primaryMission)) {
      return;
    }

    setIsUpdatingMission(true);
    setMissionError(null);

    try {
      let response = null;

      if (primaryMission.completedToday) {
        response = await uncompleteHabit(primaryMission.id, userProfile);
      } else {
        response = await completeHabit(primaryMission.id, userProfile);
      }

      const nextDashboard = applyHabitResponseToDashboard(response?.habit ?? null);
      if (!primaryMission.completedToday) {
        showAllHabitsPraiseIfReady(nextDashboard);
      }
      syncDashboardInBackground();
      setLoadError(null);
    } catch (error) {
      setMissionError(
        error instanceof Error
          ? error.message
          : "Unable to update today's mission right now.",
      );
    } finally {
      setIsUpdatingMission(false);
    }
  };

  const handleHabitCardAction = async (mission) => {
    if (!mission?.id || mission.id === "empty-first-habit") {
      router.push("/habit-create");
      return;
    }

    if (!mission.isScheduledToday) {
      getMissionRoute(router, mission.id);
      return;
    }

    if (shouldOpenHabitFocus(mission)) {
      openHabitFocusRoute(router, mission.id);
      return;
    }

    if (isNegativeHabit(mission)) {
      return;
    }

    setUpdatingHabitId(mission.id);
    setMissionError(null);

    try {
      let response = null;

      if (mission.completedToday) {
        response = await uncompleteHabit(mission.id, userProfile);
      } else {
        response = await completeHabit(mission.id, userProfile);
      }

      const nextDashboard = applyHabitResponseToDashboard(response?.habit ?? null);
      if (!mission.completedToday) {
        showAllHabitsPraiseIfReady(nextDashboard);
      }
      syncDashboardInBackground();
      setLoadError(null);
    } catch (error) {
      setMissionError(
        error instanceof Error
          ? error.message
          : "Unable to update this habit right now.",
      );
    } finally {
      setUpdatingHabitId(null);
    }
  };

  const renderHabitCard = (mission) => {
    const coinPreview = buildCoinRewardPreview({
      mission,
      player,
      dailySummary,
    });

    return (
    <View key={mission.id} style={styles.questPressable}>
      <Card style={[styles.questCard, isNegativeHabit(mission) && styles.questCardNegative]}>
        <View style={styles.questMainRow}>
          <Pressable
            onPress={() => getMissionRoute(router, mission.id)}
            style={({ pressed }) => [
              styles.questInfoPressable,
              pressed && styles.questPressablePressed,
            ]}
          >
            <View
              style={[
                styles.questIconWrap,
                isNegativeHabit(mission) && styles.questIconWrapNegative,
              ]}
            >
              <Ionicons
                color={isNegativeHabit(mission) ? "#B45309" : colors.primary}
                name={mission.icon}
                size={18}
              />
            </View>
            <View style={styles.questCopy}>
              <Text variant="subtitle">{mission.title}</Text>
              <Text color="muted" variant="body">
                {mission.currentStreak
                  ? `${mission.caption} - ${mission.currentStreak} day streak`
                  : mission.caption}
              </Text>
            </View>
          </Pressable>

            <View style={styles.questSide}>
            <View style={styles.questRewardRow}>
              <View
                style={[
                  styles.questReward,
                  isNegativeHabit(mission) && styles.questRewardNegative,
                ]}
              >
                <Text
                  color={isNegativeHabit(mission) ? undefined : "primary"}
                  style={isNegativeHabit(mission) ? styles.questRewardTextNegative : null}
                  variant="caption"
                >
                  {mission.reward}
                </Text>
              </View>

              {!isNegativeHabit(mission) ? (
                <Pressable
                  onPress={() => openCoinRules(mission)}
                  style={({ pressed }) => [
                    styles.coinRewardChip,
                    pressed && styles.coinRewardChipPressed,
                  ]}
                >
                  <Ionicons color="#D97706" name="logo-usd" size={12} />
                  <Text style={styles.coinRewardText} variant="caption">
                    +{coinPreview.estimatedGold} COIN
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {isNegativeHabit(mission) ? (
              <View style={styles.questNegativeWrap}>
                <Text color="muted" style={styles.questNegativeHint} variant="caption">
                  {getBadHabitStatusLabelVi(mission)}
                </Text>

                <View style={styles.questNegativeActions}>
                  <Pressable
                    disabled={updatingHabitId === mission.id || !mission.isScheduledToday}
                    onPress={() => void handleSetNegativeHabitStatus(mission, "avoided")}
                    style={({ pressed }) => [
                      styles.questMiniAction,
                      getHabitTodayStatus(mission) === "avoided" &&
                        styles.questMiniActionSafe,
                      pressed &&
                        updatingHabitId !== mission.id &&
                        styles.questActionButtonPressed,
                    ]}
                  >
                    <Ionicons
                      color={
                        getHabitTodayStatus(mission) === "avoided"
                          ? colors.success
                          : colors.primary
                      }
                      name="shield-checkmark-outline"
                      size={14}
                    />
                    <Text
                      color={
                        getHabitTodayStatus(mission) === "avoided"
                          ? "success"
                          : "primary"
                      }
                      style={styles.questMiniActionText}
                      variant="caption"
                    >
                      Avoided
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={updatingHabitId === mission.id || !mission.isScheduledToday}
                    onPress={() => void handleSetNegativeHabitStatus(mission, "failed")}
                    style={({ pressed }) => [
                      styles.questMiniAction,
                      getHabitTodayStatus(mission) === "failed" &&
                        styles.questMiniActionDanger,
                      pressed &&
                        updatingHabitId !== mission.id &&
                        styles.questActionButtonPressed,
                    ]}
                  >
                    <Ionicons
                      color={
                        getHabitTodayStatus(mission) === "failed"
                          ? colors.danger
                          : "#B45309"
                      }
                      name="warning-outline"
                      size={14}
                    />
                    <Text
                      style={[
                        styles.questMiniActionText,
                        getHabitTodayStatus(mission) === "failed" &&
                          styles.questMiniActionTextDanger,
                      ]}
                      variant="caption"
                    >
                      Slipped
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                disabled={updatingHabitId === mission.id}
                onPress={() => void handleHabitCardAction(mission)}
                style={({ pressed }) => [
                  styles.questActionButton,
                  mission.completedToday && styles.questActionButtonDone,
                  pressed &&
                    updatingHabitId !== mission.id &&
                    styles.questActionButtonPressed,
                ]}
              >
                {updatingHabitId === mission.id ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Ionicons
                      color={
                        mission.completedToday ? colors.success : colors.primary
                      }
                      name={getHabitActionIcon(mission)}
                      size={15}
                    />
                    <Text
                      color={mission.completedToday ? "success" : "primary"}
                      style={styles.questActionText}
                      variant="caption"
                    >
                      {getHabitActionLabel(mission)}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
  };

  const renderActiveQuestCard = (quest) => {
    const progress = Number(quest.progress ?? 0);
    const targetCount = Math.max(1, Number(quest.targetCount ?? 1));
    const ratio = Math.max(0, Math.min(1, progress / targetCount));
    const isUpdating = updatingQuestId === quest.userQuestId;

    return (
      <Card key={quest.userQuestId} style={styles.questTaskCard}>
        <View style={styles.questTaskTop}>
          <View style={styles.questIconWrap}>
            <Ionicons color={colors.primary} name={quest.icon} size={18} />
          </View>
          <View style={styles.questCopy}>
            <Text variant="subtitle">{quest.title}</Text>
            <Text color="muted" variant="body">
              {quest.description}
            </Text>
          </View>
        </View>

        <View style={styles.questProgressBlock}>
          <View style={styles.questProgressHeader}>
            <Text color="muted" variant="caption">
              Progress
            </Text>
            <Text color="primary" style={styles.questProgressValue} variant="caption">
              {progress}/{targetCount}
            </Text>
          </View>
          <View style={styles.questProgressTrack}>
            <View style={[styles.questProgressFill, { width: `${ratio * 100}%` }]} />
          </View>
        </View>

        <View style={styles.questMetaRow}>
          <View style={styles.questRewardPill}>
            <Ionicons color={colors.warning} name="flash" size={12} />
            <Text style={styles.rewardBadgeText} variant="caption">
              +{quest.expReward} EXP
            </Text>
          </View>
          <View style={styles.questRewardPill}>
            <Ionicons color="#D97706" name="logo-usd" size={12} />
            <Text style={styles.coinRewardText} variant="caption">
              +{quest.goldReward} COIN
            </Text>
          </View>
        </View>

        <View style={styles.questTaskActions}>
          <Pressable
            disabled={isUpdating}
            onPress={() => void handleQuestProgress(quest)}
            style={({ pressed }) => [
              styles.questCompleteButton,
              pressed && !isUpdating && styles.questActionButtonPressed,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <>
                <Ionicons color={colors.surface} name="add-circle" size={16} />
                <Text color="white" style={styles.primaryCtaText} variant="caption">
                  Add progress
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={isUpdating}
            onPress={() => handleAbandonQuest(quest)}
            style={({ pressed }) => [
              styles.questAbandonButton,
              pressed && !isUpdating && styles.secondaryCtaPressed,
            ]}
          >
            <Ionicons color={colors.textMuted} name="close" size={15} />
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderAvailableQuestCard = (quest) => {
    const isUpdating = updatingQuestId === quest.id;

    return (
      <Card key={quest.id} style={styles.questOfferCard}>
        <View style={styles.questTaskTop}>
          <View style={styles.questIconWrap}>
            <Ionicons color={colors.primary} name={quest.icon} size={18} />
          </View>
          <View style={styles.questCopy}>
            <Text variant="subtitle">{quest.title}</Text>
            <Text color="muted" variant="body">
              {quest.description}
            </Text>
          </View>
        </View>

        <View style={styles.questMetaRow}>
          <Text color="muted" style={styles.questDifficultyText} variant="caption">
            {quest.difficulty.toUpperCase()} - {quest.targetCount} steps
          </Text>
          <Text color="primary" style={styles.questProgressValue} variant="caption">
            +{quest.expReward} EXP / +{quest.goldReward} COIN
          </Text>
        </View>

        <Pressable
          disabled={isUpdating}
          onPress={() => void handleAcceptQuest(quest)}
          style={({ pressed }) => [
            styles.questAcceptButton,
            pressed && !isUpdating && styles.questActionButtonPressed,
          ]}
        >
          {isUpdating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons color={colors.primary} name="add-circle-outline" size={15} />
              <Text color="primary" style={styles.questActionText} variant="caption">
                Accept quest
              </Text>
            </>
          )}
        </Pressable>
      </Card>
    );
  };

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.sectionBlock}>
        <Card style={styles.playerCard}>
          <View style={styles.playerTop}>
            <View style={styles.avatarWrap}>
              <ProfileAvatar
                avatarUrl={profileAvatarUrl}
                name={profileName}
                seed={userProfile?.id ?? profileName}
                size={60}
                style={styles.avatarCircle}
                textStyle={styles.avatarText}
              />
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

                <View style={styles.goldBadge}>
                  <View style={styles.goldIconCircle}>
                    <Ionicons color="#FFFFFF" name="logo-usd" size={16} />
                  </View>
                  <Text style={styles.goldText} variant="label">
                    {goldCoins}
                  </Text>
                </View>
              </View>

              <View style={styles.statGroup}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel} variant="caption">
                    HP
                  </Text>
                  <Text style={styles.statValue} variant="caption">
                    {hp}/{hpMax}
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

      <Animated.View entering={FadeInDown.duration(400).delay(10)} style={styles.sectionBlock}>
        <Card style={styles.todayMissionCard}>
          {hasAnyHabits && trackedMissionCount > 0 && completedMissionCount >= trackedMissionCount ? (
            <View style={styles.allDoneWrap}>
              <View style={styles.allDoneIcon}>
                <Ionicons color={colors.success} name="checkmark-circle" size={56} />
              </View>
              <Text style={styles.allDoneTitle} variant="title">
                You&apos;re all set!
              </Text>
              <Text color="muted" style={styles.allDoneText} variant="body">
                You&apos;ve completed all your scheduled routines for today. Great job!
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.todayMissionHeader}>
                <View style={styles.todayMissionHeaderCopy}>
                  <Text color="primary" variant="label">
                    Today&apos;s Mission
                  </Text>
                  <Text style={styles.todayMissionTitle} variant="title">
                    {primaryMission?.title ?? "Create your first habit"}
                  </Text>
                </View>

                <View style={styles.rewardBadgeRow}>
                  <View style={styles.rewardBadge}>
                    <Ionicons color={colors.warning} name="flash" size={14} />
                    <Text style={styles.rewardBadgeText} variant="caption">
                      {primaryMission?.reward ?? "+20 EXP"}
                    </Text>
                  </View>

                  {!isNegativeHabit(primaryMission) ? (
                    <Pressable
                      onPress={() => openCoinRules(primaryMission)}
                      style={({ pressed }) => [
                        styles.coinRewardChip,
                        styles.rewardCoinChip,
                        pressed && styles.coinRewardChipPressed,
                      ]}
                    >
                      <Ionicons color="#D97706" name="logo-usd" size={12} />
                      <Text style={styles.coinRewardText} variant="caption">
                        +{primaryMissionCoinPreview.estimatedGold} COIN
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

          <Text color="muted" style={styles.todayMissionBody} variant="body">
            {hasAnyHabits
              ? `${scheduleLabel}. ${frequencyLabel}. Keep ${lifeAreaLabel} moving forward.`
              : "Start with one real-world habit like drinking water, walking after lunch, or reading 15 pages."}
          </Text>

          {missionError ? (
            <Text style={styles.missionError} variant="caption">
              {missionError}
            </Text>
          ) : null}

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

          <View
            style={[
              styles.ctaRow,
              isNegativeHabit(primaryMission) && styles.ctaRowStack,
            ]}
          >
            {isNegativeHabit(primaryMission) ? (
              <View style={styles.primaryNegativeWrap}>
                <Text color="muted" style={styles.primaryNegativeHint} variant="caption">
                  {getBadHabitStatusLabelVi(primaryMission)}
                </Text>

                <View style={styles.primaryNegativeActions}>
                  <Pressable
                    disabled={!primaryMission?.isScheduledToday}
                    onPress={() => void handleSetNegativeHabitStatus(primaryMission, "avoided")}
                    style={({ pressed }) => [
                      styles.primaryNegativeButton,
                      getHabitTodayStatus(primaryMission) === "avoided" &&
                        styles.primaryNegativeButtonSafe,
                      !primaryMission?.isScheduledToday && styles.primaryCtaDisabled,
                      pressed && styles.primaryCtaPressed,
                    ]}
                  >
                    <Ionicons
                      color={
                        getHabitTodayStatus(primaryMission) === "avoided"
                          ? colors.success
                          : colors.primary
                      }
                      name="shield-checkmark-outline"
                      size={18}
                    />
                    <Text
                      color={
                        getHabitTodayStatus(primaryMission) === "avoided"
                          ? "success"
                          : "primary"
                      }
                      numberOfLines={2}
                      style={styles.primaryNegativeText}
                      variant="label"
                    >
                      Avoided today
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={!primaryMission?.isScheduledToday}
                    onPress={() => void handleSetNegativeHabitStatus(primaryMission, "failed")}
                    style={({ pressed }) => [
                      styles.primaryNegativeButton,
                      getHabitTodayStatus(primaryMission) === "failed" &&
                        styles.primaryNegativeButtonDanger,
                      !primaryMission?.isScheduledToday && styles.primaryCtaDisabled,
                      pressed && styles.primaryCtaPressed,
                    ]}
                  >
                    <Ionicons
                      color={
                        getHabitTodayStatus(primaryMission) === "failed"
                          ? colors.danger
                          : "#B45309"
                      }
                      name="warning-outline"
                      size={18}
                    />
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.primaryNegativeText,
                        getHabitTodayStatus(primaryMission) === "failed" &&
                          styles.primaryNegativeTextDanger,
                      ]}
                      variant="label"
                    >
                      I slipped
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => void handlePrimaryMission()}
                style={({ pressed }) => [
                  styles.primaryCta,
                  isUpdatingMission && styles.primaryCtaDisabled,
                  pressed && styles.primaryCtaPressed,
                ]}
              >
                <Ionicons
                  color={colors.surface}
                  name={
                    getHabitActionIcon(primaryMission, {
                      completed: "refresh-circle",
                      complete: "checkmark-circle",
                    })
                  }
                  size={18}
                />
                <Text color="white" style={styles.primaryCtaText} variant="label">
                  {isUpdatingMission
                    ? "Updating..."
                    : primaryMission?.id === "empty-first-habit"
                      ? "Add habit"
                      : getHabitActionLabel(primaryMission, {
                          completed: "Undo completion",
                          complete: "Complete now",
                          open: "Open mission",
                        })}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                primaryMission?.id &&
                primaryMission.id !== "empty-first-habit"
                  ? getMissionRoute(router, primaryMission.id)
                  : router.push("/habit-create")
              }
              style={({ pressed }) => [
                styles.secondaryCta,
                isNegativeHabit(primaryMission) && styles.secondaryCtaFullWidth,
                pressed && styles.secondaryCtaPressed,
              ]}
            >
              <Ionicons
                color={colors.primary}
                name={
                  primaryMission?.id && primaryMission.id !== "empty-first-habit"
                    ? "open-outline"
                    : "add-circle-outline"
                }
                size={18}
              />
              <Text
                color="primary"
                numberOfLines={1}
                style={styles.secondaryCtaText}
                variant="label"
              >
                {primaryMission?.id && primaryMission.id !== "empty-first-habit"
                  ? "Open habit"
                  : "Add Habit"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  </Animated.View>

      {loadError ? (
        <Animated.View entering={FadeInDown.duration(420).delay(20)} style={styles.sectionBlock}>
          <Card style={styles.errorCard}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
            <Text style={styles.errorText} variant="body">
              {loadError}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      {praiseMessage ? (
        <Animated.View entering={FadeInDown.duration(430).delay(30)} style={styles.sectionBlock}>
          <Card style={styles.praiseCard}>
            <Ionicons color={colors.success} name="sparkles-outline" size={18} />
            <Text style={styles.praiseText} variant="body">
              {praiseMessage}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View
        entering={FadeInDown.duration(450).delay(45)}
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
            Check marks show successful days, red marks show missed active days, and the flame highlights your current streak.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(460).delay(55)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text variant="subtitle">Quests</Text>
            <Text color="muted" variant="body">
              Side objectives with extra rewards
            </Text>
          </View>
          <View style={styles.questHeaderActions}>
            <Pressable
              disabled={isGeneratingAiQuest}
              onPress={() => void handleGenerateAiQuest()}
              style={({ pressed }) => [
                styles.aiQuestButton,
                pressed && !isGeneratingAiQuest && styles.questActionButtonPressed,
                isGeneratingAiQuest && styles.aiQuestButtonDisabled,
              ]}
            >
              {isGeneratingAiQuest ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons color={colors.primary} name="sparkles-outline" size={15} />
                  <Text color="primary" style={styles.questActionText} variant="caption">
                    AI Quest
                  </Text>
                </>
              )}
            </Pressable>

            {isLoadingQuests ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Pressable
                accessibilityLabel={isQuestsCollapsed ? "Expand quests" : "Collapse quests"}
                onPress={() => setIsQuestsCollapsed((current) => !current)}
                style={({ pressed }) => [
                  styles.collapseButton,
                  pressed && styles.collapseButtonPressed,
                ]}
              >
                <Ionicons
                  color={colors.primary}
                  name={isQuestsCollapsed ? "chevron-down" : "chevron-up"}
                  size={18}
                />
              </Pressable>
            )}
          </View>
        </View>

        {!isQuestsCollapsed && questError ? (
          <Card style={styles.errorCard}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
            <Text style={styles.errorText} variant="body">
              {questError}
            </Text>
          </Card>
        ) : null}

        {!isQuestsCollapsed && activeQuests.length > 0 ? (
          <View style={styles.questList}>
            {activeQuests.map(renderActiveQuestCard)}
          </View>
        ) : null}

        {!isQuestsCollapsed && !isLoadingQuests && activeQuests.length === 0 ? (
          <Card style={styles.emptyQuestCard}>
            <Ionicons color={colors.primary} name="flag-outline" size={18} />
            <Text variant="body">No active quests. Pick one from the board.</Text>
          </Card>
        ) : null}

        {!isQuestsCollapsed && availableQuests.length > 0 ? (
          <View style={styles.questOfferList}>
            {availableQuests.slice(0, 3).map(renderAvailableQuestCard)}
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(470).delay(60)}
        style={styles.sectionBlock}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text variant="subtitle">Good Habits</Text>
            <Text color="muted" variant="body">
              Positive routines for today
            </Text>
          </View>
          <Pressable
            accessibilityLabel={
              isGoodHabitsCollapsed ? "Expand good habits" : "Collapse good habits"
            }
            onPress={() => setIsGoodHabitsCollapsed((current) => !current)}
            style={({ pressed }) => [
              styles.collapseButton,
              pressed && styles.collapseButtonPressed,
            ]}
          >
            <Ionicons
              color={colors.primary}
              name={isGoodHabitsCollapsed ? "chevron-down" : "chevron-up"}
              size={18}
            />
          </Pressable>
        </View>

        {!isGoodHabitsCollapsed && goodHabitItems.length > 0 ? (
          <View style={styles.questList}>
            {goodHabitItems.map(renderHabitCard)}
          </View>
        ) : null}

        {!isGoodHabitsCollapsed && goodHabitItems.length === 0 ? (
          <Card style={styles.emptyQuestCard}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
            <Text variant="body">No good habits yet. Add one to start building momentum.</Text>
          </Card>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(490).delay(75)}
        style={styles.sectionBlock}   
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text variant="subtitle">Bad Habits</Text>
            <Text color="muted" variant="body">
              Check in and keep them under control
            </Text>
          </View>
          <Pressable
            accessibilityLabel={
              isBadHabitsCollapsed ? "Expand bad habits" : "Collapse bad habits"
            }
            onPress={() => setIsBadHabitsCollapsed((current) => !current)}
            style={({ pressed }) => [
              styles.collapseButton,
              pressed && styles.collapseButtonPressed,
            ]}
          >
            <Ionicons
              color={colors.primary}
              name={isBadHabitsCollapsed ? "chevron-down" : "chevron-up"}
              size={18}
            />
          </Pressable>
        </View>

        {!isBadHabitsCollapsed && badHabitItems.length > 0 ? (
          <View style={styles.questList}>
            {badHabitItems.map(renderHabitCard)}
          </View>
        ) : null}

        {!isBadHabitsCollapsed && badHabitItems.length === 0 ? (
          <Card style={styles.emptyQuestCard}>
            <Ionicons color="#B45309" name="shield-outline" size={18} />
            <Text variant="body">No bad habits tracked right now.</Text>
          </Card>
        ) : null}
      </Animated.View>

      <View style={styles.actions}>
        <SecondaryButton
          label="Manage Habits"
          onPress={() => router.push("/habit-manage")}
        />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeCoinRules}
        transparent
        visible={!!selectedCoinMission}
      >
        <Pressable onPress={closeCoinRules} style={styles.modalBackdrop}>
          <Pressable onPress={() => {}} style={styles.coinModalCard}>
            <View style={styles.coinModalHeader}>
              <View style={styles.coinModalTitleWrap}>
                <Text variant="subtitle">Coin Reward Rule</Text>
                <Text color="muted" variant="caption">
                  {selectedCoinMission?.title ?? "Habit"}
                </Text>
              </View>

              <Pressable onPress={closeCoinRules} style={styles.coinModalClose}>
                <Ionicons color={colors.textMuted} name="close" size={18} />
              </Pressable>
            </View>

            {selectedCoinBreakdown ? (
              <>
                <View style={styles.coinModalSummary}>
                  <Text color="muted" variant="caption">
                    Estimated if you complete this habit next
                  </Text>
                  <Text style={styles.coinModalSummaryValue} variant="title">
                    +{selectedCoinBreakdown.estimatedGold} coin
                  </Text>
                </View>

                <View style={styles.coinRuleList}>
                  <View style={styles.coinRuleRow}>
                    <Text color="muted" variant="body">
                      Base task reward
                    </Text>
                    <Text style={styles.coinRuleValue} variant="body">
                      +{selectedCoinBreakdown.taskGold}
                    </Text>
                  </View>

                  <View style={styles.coinRuleRow}>
                    <Text color="muted" variant="body">
                      Daily streak bonus
                    </Text>
                    <Text style={styles.coinRuleValue} variant="body">
                      +{selectedCoinBreakdown.streakGold}
                    </Text>
                  </View>

                  <View style={styles.coinRuleRow}>
                    <Text color="muted" variant="body">
                      Level up bonus
                    </Text>
                    <Text style={styles.coinRuleValue} variant="body">
                      +{selectedCoinBreakdown.levelUpGold}
                    </Text>
                  </View>

                  <View style={styles.coinRuleRow}>
                    <Text color="muted" variant="body">
                      Finish all habits today
                    </Text>
                    <Text style={styles.coinRuleValue} variant="body">
                      +{selectedCoinBreakdown.dailyCompletionGold}
                    </Text>
                  </View>
                </View>

                <Text color="muted" style={styles.coinModalFootnote} variant="caption">
                  {selectedCoinBreakdown.note}
                </Text>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: spacing.xxl * 4,
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
  goldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF9E8",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.25,
    borderColor: "#F8DD7D",
  },
  goldIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFC323",
  },
  goldText: {
    color: "#D97706",
    fontWeight: "700",
    fontSize: 13,
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
  praiseCard: {
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: "#F1FBF5",
    borderWidth: 1,
    borderColor: "#BEE8CC",
  },
  praiseText: {
    flex: 1,
    color: "#166534",
  },
  playerHintText: {
    flex: 1,
    lineHeight: 17,
  },
  todayMissionCard: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: 28,
  },
  todayMissionHeader: {
    gap: spacing.sm,
  },
  todayMissionHeaderCopy: {
    gap: 2,
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
  rewardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rewardCoinChip: {
    minHeight: 34,
  },
  todayMissionBody: {
    lineHeight: 22,
  },
  allDoneWrap: {
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  allDoneIcon: {
    marginBottom: spacing.xs,
  },
  allDoneTitle: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  allDoneText: {
    textAlign: "center",
    lineHeight: 22,
  },
  missionError: {
    color: colors.danger,
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
    alignItems: "stretch",
    gap: spacing.sm,
  },
  ctaRowStack: {
    flexDirection: "column",
  },
  primaryNegativeWrap: {
    width: "100%",
    gap: 8,
  },
  primaryNegativeHint: {
    paddingHorizontal: 2,
  },
  primaryNegativeActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryNegativeButton: {
    flex: 1,
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
  primaryNegativeButtonSafe: {
    borderColor: "#BEE8CC",
    backgroundColor: "#F1FBF5",
  },
  primaryNegativeButtonDanger: {
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF6F7",
  },
  primaryNegativeText: {
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },
  primaryNegativeTextDanger: {
    color: colors.danger,
    fontWeight: "700",
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
  primaryCtaDisabled: {
    opacity: 0.78,
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
  secondaryCtaFullWidth: {
    width: "100%",
  },
  secondaryCtaPressed: {
    opacity: 0.85,
  },
  secondaryCtaText: {
    fontWeight: "700",
    flexShrink: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  collapseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
  },
  collapseButtonPressed: {
    opacity: 0.82,
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
  },
  questCardNegative: {
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
  },
  questMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  questInfoPressable: {
    flex: 1,
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
  questIconWrapNegative: {
    backgroundColor: "#FFF1E8",
  },
  questCopy: {
    flex: 1,
    gap: 2,
  },
  questSide: {
    alignItems: "flex-end",
    gap: 8,
  },
  questNegativeWrap: {
    alignItems: "flex-end",
    gap: 6,
  },
  questNegativeHint: {
    textAlign: "right",
  },
  questNegativeActions: {
    flexDirection: "row",
    gap: 6,
  },
  questMiniAction: {
    minWidth: 84,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  questMiniActionSafe: {
    borderColor: "#BEE8CC",
    backgroundColor: "#F1FBF5",
  },
  questMiniActionDanger: {
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF6F7",
  },
  questMiniActionText: {
    fontWeight: "700",
  },
  questMiniActionTextDanger: {
    color: colors.danger,
  },
  questReward: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D6E2F6",
  },
  questRewardNegative: {
    backgroundColor: "#FFF1E8",
    borderColor: "#FED7AA",
  },
  questRewardTextNegative: {
    color: "#B45309",
    fontWeight: "700",
  },
  questRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  questHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  aiQuestButton: {
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  aiQuestButtonDisabled: {
    opacity: 0.7,
  },
  questTaskCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  questOfferList: {
    gap: spacing.sm,
  },
  questOfferCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#D7E5FB",
    backgroundColor: "#F8FBFF",
  },
  questTaskTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  questProgressBlock: {
    gap: 6,
  },
  questProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  questProgressValue: {
    fontWeight: "700",
  },
  questProgressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "#DCE7F8",
    overflow: "hidden",
  },
  questProgressFill: {
    height: "100%",
    minWidth: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  questMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  questRewardPill: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: "#FFF9E8",
    borderWidth: 1,
    borderColor: "#F8DD7D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questDifficultyText: {
    fontWeight: "700",
  },
  questTaskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  questCompleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  questAbandonButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: "#D6E2F6",
  },
  questAcceptButton: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  coinRewardChip: {
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#F8DD7D",
    backgroundColor: "#FFF9E8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coinRewardChipPressed: {
    opacity: 0.82,
  },
  coinRewardText: {
    color: "#D97706",
    fontWeight: "700",
  },
  questActionButton: {
    minWidth: 96,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  questActionButtonDone: {
    borderColor: "#BEE8CC",
    backgroundColor: "#F1FBF5",
  },
  questActionButtonPressed: {
    opacity: 0.82,
  },
  questActionText: {
    fontWeight: "700",
  },
  errorCard: {
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FBCBD3",
  },
  errorText: {
    flex: 1,
    color: "#9F1239",
  },
  emptyQuestCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  coinModalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
    padding: spacing.lg,
    gap: spacing.md,
  },
  coinModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  coinModalTitleWrap: {
    flex: 1,
    gap: 2,
  },
  coinModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFD",
  },
  coinModalSummary: {
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: "#FFF9E8",
    gap: 4,
  },
  coinModalSummaryValue: {
    color: "#D97706",
    fontSize: 26,
    lineHeight: 32,
  },
  coinRuleList: {
    gap: 10,
  },
  coinRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  coinRuleValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  coinModalFootnote: {
    lineHeight: 18,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
