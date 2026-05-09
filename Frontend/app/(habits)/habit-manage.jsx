import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import EmptyStateCard from "@/src/components/ui/EmptyStateCard";
import PrimaryButton from "@/src/components/ui/PrimaryButton";
import ScreenContainer from "@/src/components/ui/ScreenContainer";
import SecondaryButton from "@/src/components/ui/SecondaryButton";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import {
  clearHabitStatus,
  completeHabit,
  deleteHabit,
  listHabits,
  setHabitStatus,
  uncompleteHabit,
} from "@/src/services/habit.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import {
  getHabitActionIcon,
  getHabitActionLabel,
  openHabitFocusRoute,
  shouldOpenHabitFocus,
} from "@/src/utils/habitActions";
import {
  getBadHabitStatusLabel,
  getBadHabitStatusLabelVi,
  getHabitTodayStatus,
  isNegativeHabit,
} from "@/src/utils/habitStatus";
import { formatTimeLabel } from "@/src/utils/onboarding";

function getFrequencyLabel(habit) {
  if (habit.frequencyType === "weekly") {
    if (!habit.frequencyDays?.length) {
      return "Weekly";
    }

    return `Weekly - ${habit.frequencyDays
      .map((day) => day.slice(0, 3).toUpperCase())
      .join(", ")}`;
  }

  if (habit.frequencyType === "monthly") {
    return "Monthly";
  }

  return "Daily";
}

function getTargetLabel(habit) {
  const periodLabel =
    habit.frequencyType === "monthly"
      ? "month"
      : habit.frequencyType === "weekly"
        ? "week"
        : "day";

  if (isNegativeHabit(habit)) {
    return `Up to ${habit.targetValue} ${habit.targetUnit} per ${periodLabel}`;
  }

  return `${habit.targetValue} ${habit.targetUnit} per ${periodLabel}`;
}

function getReminderLabel(habit) {
  return habit.reminders?.[0]
    ? formatTimeLabel(habit.reminders[0])
    : "No reminder";
}

const typeFilterOptions = [
  { key: "all", label: "All" },
  { key: "positive", label: "Good" },
  { key: "negative", label: "Bad" },
];

const statusFilterOptions = [
  { key: "all", label: "Any status" },
  { key: "scheduled", label: "Due today" },
  { key: "open", label: "Needs action" },
  { key: "done", label: "Done today" },
  { key: "not_due", label: "Not due" },
];

function normalizeSearchValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesSearch(habit, query) {
  if (!query) {
    return true;
  }

  const searchFields = [
    habit.title,
    habit.categoryLabel,
    habit.preferredTime,
    habit.targetUnit,
    getFrequencyLabel(habit),
    getReminderLabel(habit),
  ];

  return searchFields.some((field) =>
    normalizeSearchValue(field).includes(query),
  );
}

function matchesTypeFilter(habit, filter) {
  if (filter === "positive") {
    return !isNegativeHabit(habit);
  }

  if (filter === "negative") {
    return isNegativeHabit(habit);
  }

  return true;
}

function matchesStatusFilter(habit, filter) {
  const todayStatus = getHabitTodayStatus(habit);

  if (filter === "scheduled") {
    return habit.isScheduledToday;
  }

  if (filter === "open") {
    return habit.isScheduledToday && !habit.loggedToday;
  }

  if (filter === "done") {
    return habit.completedToday;
  }

  if (filter === "not_due") {
    return !habit.isScheduledToday;
  }

  if (filter === "all") {
    return true;
  }

  return Boolean(todayStatus);
}

export default function ManageHabitsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { completed, userProfile } = useOnboarding();
  const [habits, setHabits] = useState([]);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [draftTypeFilter, setDraftTypeFilter] = useState("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const hasLoadedHabitsRef = useRef(false);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const filteredHabits = habits.filter(
    (habit) =>
      matchesSearch(habit, normalizedSearchQuery) &&
      matchesTypeFilter(habit, typeFilter) &&
      matchesStatusFilter(habit, statusFilter),
  );
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  useEffect(() => {
    if (!completed || !userProfile?.id || !isFocused) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const profileOverride = {
      id: userProfile.id,
      accessToken: userProfile.accessToken,
    };

    const fetchHabits = async () => {
      if (!hasLoadedHabitsRef.current) {
        setIsLoading(true);
      }

      try {
        const response = await listHabits(profileOverride);

        if (isMounted) {
          setHabits(response?.habits ?? []);
          hasLoadedHabitsRef.current = true;
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load habits right now.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void fetchHabits();

    return () => {
      isMounted = false;
    };
  }, [completed, isFocused, userProfile?.accessToken, userProfile?.id]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)");
  };

  const handleRefresh = async () => {
    if (!userProfile?.id) {
      return;
    }

    const profileOverride = {
      id: userProfile.id,
      accessToken: userProfile.accessToken,
    };

    setIsRefreshing(true);

    try {
      const response = await listHabits(profileOverride, { forceRefresh: true });
      setHabits(response?.habits ?? []);
      hasLoadedHabitsRef.current = true;
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh habits right now.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (habitId) => {
    setDeletingId(habitId);
    setError(null);

    try {
      await deleteHabit(habitId, userProfile);
      setHabits((currentHabits) =>
        currentHabits.filter((habit) => habit.id !== habitId),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this habit right now.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleComplete = async (habit) => {
    if (shouldOpenHabitFocus(habit)) {
      openHabitFocusRoute(router, habit.id);
      return;
    }

    setTogglingId(habit.id);
    setError(null);

    try {
      const response = habit.completedToday
        ? await uncompleteHabit(habit.id, userProfile)
        : await completeHabit(habit.id, userProfile);
      const updatedHabit = response?.habit ?? null;

      if (!updatedHabit) {
        throw new Error("Unable to refresh this habit right now.");
      }

      setHabits((currentHabits) =>
        currentHabits.map((currentHabit) =>
          currentHabit.id === habit.id ? updatedHabit : currentHabit,
        ),
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update this habit right now.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleSetNegativeHabitStatus = async (habit, status) => {
    setTogglingId(habit.id);
    setError(null);

    try {
      const currentStatus = getHabitTodayStatus(habit);
      const response =
        currentStatus === status
          ? await clearHabitStatus(habit.id, userProfile)
          : await setHabitStatus(habit.id, status, userProfile);
      const updatedHabit = response?.habit ?? null;

      if (!updatedHabit) {
        throw new Error("Unable to refresh this habit right now.");
      }

      setHabits((currentHabits) =>
        currentHabits.map((currentHabit) =>
          currentHabit.id === habit.id ? updatedHabit : currentHabit,
        ),
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update this habit right now.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = (habit) => {
    Alert.alert(
      "Delete habit",
      `Delete "${habit.title}" from your habits list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDelete(habit.id);
          },
        },
      ],
    );
  };

  const resetFilters = () => {
    setSearchInputValue("");
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const applySearch = () => {
    setSearchQuery(searchInputValue);
  };

  const openFilterModal = () => {
    setDraftTypeFilter(typeFilter);
    setDraftStatusFilter(statusFilter);
    setIsFilterModalVisible(true);
  };

  const closeFilterModal = () => {
    setIsFilterModalVisible(false);
  };

  const applyFilterSelections = () => {
    setTypeFilter(draftTypeFilter);
    setStatusFilter(draftStatusFilter);
    setIsFilterModalVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftTypeFilter("all");
    setDraftStatusFilter("all");
  };

  if (!completed || !userProfile?.id) {
    return (
      <ScreenContainer contentContainerStyle={styles.emptyWrap}>
        <EmptyStateCard
          actionLabel="Continue to Login"
          description="Sign in first, then you can manage all your habits here."
          onAction={() => router.replace("/welcome")}
          title="Sign in required"
        />
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScreenContainer
      scroll={false}
      contentContainerStyle={styles.staticContent}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.headerIcon,
            pressed && styles.headerIconPressed,
          ]}
        >
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text variant="title">Manage Habits</Text>
        </View>
      </View>

      <View style={styles.topControls}>
        <View style={styles.toolbarCard}>
          <View style={styles.toolbarRow}>
            <View style={styles.searchWrap}>
              <Ionicons color="#64748B" name="search-outline" size={17} />
              <TextInput
                onChangeText={setSearchInputValue}
                onSubmitEditing={applySearch}
                placeholder="Search habits"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                style={styles.searchInput}
                value={searchInputValue}
              />
              {searchInputValue ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  onPress={() => {
                    setSearchInputValue("");
                    setSearchQuery("");
                  }}
                  style={({ pressed }) => [
                    styles.searchClearButton,
                    pressed && styles.controlButtonPressed,
                  ]}
                >
                  <Ionicons color="#64748B" name="close-circle" size={17} />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel="Search habits"
              onPress={applySearch}
              style={({ pressed }) => [
                styles.iconActionButton,
                pressed && styles.controlButtonPressed,
              ]}
            >
              <Ionicons color={colors.primary} name="search" size={17} />
            </Pressable>

            <Pressable
              accessibilityLabel="Open filters"
              onPress={openFilterModal}
              style={({ pressed }) => [
                styles.iconActionButton,
                hasActiveFilters && styles.iconActionButtonActive,
                pressed && styles.controlButtonPressed,
              ]}
            >
              <Ionicons
                color={hasActiveFilters ? colors.surface : colors.primary}
                name="options-outline"
                size={17}
              />
            </Pressable>
          </View>
        </View>

        <PrimaryButton
          icon={<Ionicons color={colors.surface} name="add" size={16} />}
          label="Create Habit"
          onPress={() => router.push("/habit-create")}
          style={styles.compactCreateButton}
        />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeFilterModal}
        transparent
        visible={isFilterModalVisible}
      >
        <Pressable onPress={closeFilterModal} style={styles.modalOverlay} />
        <View style={styles.modalWrap}>
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <View style={styles.filterModalCopy}>
                <Text variant="subtitle">Filter habits</Text>
                <Text color="muted" variant="body">
                  Narrow the list to the habits you want to work with.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close filters"
                onPress={closeFilterModal}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.controlButtonPressed,
                ]}
              >
                <Ionicons color="#64748B" name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.filterSection}>
              <Text color="muted" variant="caption">
                Habit type
              </Text>
              <View style={styles.filterRow}>
                {typeFilterOptions.map((option) => {
                  const isActive = draftTypeFilter === option.key;

                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setDraftTypeFilter(option.key)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        isActive && styles.filterChipActive,
                        pressed && styles.controlButtonPressed,
                      ]}
                    >
                      <Text
                        color={isActive ? "white" : "muted"}
                        style={isActive && styles.filterChipTextActive}
                        variant="caption"
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text color="muted" variant="caption">
                Status
              </Text>
              <View style={styles.filterRow}>
                {statusFilterOptions.map((option) => {
                  const isActive = draftStatusFilter === option.key;

                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setDraftStatusFilter(option.key)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        isActive && styles.filterChipActive,
                        pressed && styles.controlButtonPressed,
                      ]}
                    >
                      <Text
                        color={isActive ? "white" : "muted"}
                        style={isActive && styles.filterChipTextActive}
                        variant="caption"
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton label="Apply filters" onPress={applyFilterSelections} />
              <SecondaryButton label="Reset filters" onPress={resetDraftFilters} />
              <SecondaryButton label="Cancel" onPress={closeFilterModal} />
            </View>
          </View>
        </View>
      </Modal>

      {error ? (
        <Text style={styles.errorText} variant="caption">
          {error}
        </Text>
      ) : null}

      {!habits.length ? (
        <View style={styles.emptyListWrap}>
          <EmptyStateCard
            actionLabel="Create your first habit"
            description="You do not have any saved habits yet. Start by adding one."
            onAction={() => router.push("/habit-create")}
            title="No habits yet"
          />
        </View>
      ) : !filteredHabits.length ? (
        <View style={styles.emptyListWrap}>
          <EmptyStateCard
            actionLabel="Clear filters"
            description="Try a different keyword or reset the current filters to see more habits."
            onAction={resetFilters}
            title="No matching habits"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              onRefresh={() => void handleRefresh()}
              refreshing={isRefreshing}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredHabits.map((habit) => {
            const todayStatus = getHabitTodayStatus(habit);
            const isBadHabit = isNegativeHabit(habit);
            const isAvoided = todayStatus === "avoided";
            const isFailed = todayStatus === "failed";

            return (
              <View key={habit.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <Text variant="subtitle">{habit.title}</Text>
                    <Text color="muted" variant="body">
                      {getTargetLabel(habit)} - {getFrequencyLabel(habit)}
                    </Text>
                  </View>

                  <View style={styles.timePill}>
                    <Ionicons
                      color={colors.primary}
                      name="notifications-outline"
                      size={14}
                    />
                    <Text color="primary" variant="caption">
                      {getReminderLabel(habit)}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaWrap}>
                  <View style={styles.metaChip}>
                    <Ionicons color="#64748B" name="folder-outline" size={14} />
                    <Text color="muted" variant="caption">
                      {habit.categoryLabel ?? "General"}
                    </Text>
                  </View>

                  <View style={styles.metaChip}>
                    <Ionicons color="#64748B" name="sunny-outline" size={14} />
                    <Text color="muted" variant="caption">
                      {habit.preferredTime ?? "morning"}
                    </Text>
                  </View>

                  <View style={styles.metaChip}>
                    <Ionicons
                      color={isBadHabit ? "#B45309" : "#F59E0B"}
                      name={isBadHabit ? "shield-outline" : "flame-outline"}
                      size={14}
                    />
                    <Text color="muted" variant="caption">
                      {habit.currentStreak ?? 0} day streak
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      habit.completedToday && styles.statusChipDone,
                      habit.isScheduledToday && !habit.completedToday && styles.statusChipToday,
                    ]}
                  >
                    <Ionicons
                      color={
                        habit.completedToday
                          ? colors.success
                          : habit.isScheduledToday
                            ? colors.primary
                            : "#64748B"
                      }
                      name={
                        habit.completedToday
                          ? "checkmark-circle-outline"
                          : habit.isScheduledToday
                            ? "sparkles-outline"
                            : "calendar-outline"
                      }
                      size={14}
                    />
                    <Text
                      color={
                        isBadHabit
                          ? isAvoided
                            ? "success"
                            : isFailed
                              ? "danger"
                              : habit.isScheduledToday
                                ? "primary"
                                : "muted"
                          : habit.completedToday
                            ? "success"
                            : habit.isScheduledToday
                              ? "primary"
                              : "muted"
                      }
                      variant="caption"
                    >
                      {isBadHabit
                        ? getBadHabitStatusLabelVi(habit)
                        : habit.completedToday
                          ? "Completed today"
                          : todayStatus === "punished"
                            ? "Punished"
                            : todayStatus === "missed"
                              ? "Missed"
                              : habit.isScheduledToday
                                ? "Due today"
                                : "Not due today"}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  {isBadHabit ? (
                    <View style={styles.negativeActionsWrap}>
                      <Text color="muted" style={styles.negativeHint} variant="caption">
                        {getBadHabitStatusLabel(habit)}
                      </Text>

                      <View style={styles.negativeActionsRow}>
                        <Pressable
                          disabled={togglingId === habit.id || !habit.isScheduledToday}
                          onPress={() => void handleSetNegativeHabitStatus(habit, "avoided")}
                          style={({ pressed }) => [
                            styles.negativeActionButton,
                            isAvoided && styles.negativeActionButtonSafe,
                            !habit.isScheduledToday && styles.completeButtonDisabled,
                            pressed &&
                              togglingId !== habit.id &&
                              habit.isScheduledToday &&
                              styles.completeButtonPressed,
                          ]}
                        >
                          {togglingId === habit.id ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                          ) : (
                            <>
                              <Ionicons
                                color={isAvoided ? colors.success : colors.primary}
                                name="shield-checkmark-outline"
                                size={16}
                              />
                              <Text
                                color={isAvoided ? "success" : "primary"}
                                style={styles.completeText}
                                numberOfLines={1}
                                variant="label"
                              >
                                Avoided today
                              </Text>
                            </>
                          )}
                        </Pressable>

                        <Pressable
                          disabled={togglingId === habit.id || !habit.isScheduledToday}
                          onPress={() => void handleSetNegativeHabitStatus(habit, "failed")}
                          style={({ pressed }) => [
                            styles.negativeActionButton,
                            isFailed && styles.negativeActionButtonDanger,
                            !habit.isScheduledToday && styles.completeButtonDisabled,
                            pressed &&
                              togglingId !== habit.id &&
                              habit.isScheduledToday &&
                              styles.completeButtonPressed,
                          ]}
                        >
                          {togglingId === habit.id ? (
                            <ActivityIndicator color={colors.danger} size="small" />
                          ) : (
                            <>
                              <Ionicons
                                color={isFailed ? colors.danger : "#B45309"}
                                name="warning-outline"
                                size={16}
                              />
                              <Text
                                style={[
                                  styles.completeText,
                                  isFailed && styles.negativeDangerText,
                                ]}
                                numberOfLines={1}
                                variant="label"
                              >
                                I slipped
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      disabled={togglingId === habit.id || !habit.isScheduledToday}
                      onPress={() => void handleToggleComplete(habit)}
                      style={({ pressed }) => [
                        styles.completeButton,
                        styles.primaryActionButton,
                        habit.completedToday && styles.completeButtonDone,
                        !habit.isScheduledToday && styles.completeButtonDisabled,
                        pressed &&
                          togglingId !== habit.id &&
                          habit.isScheduledToday &&
                          styles.completeButtonPressed,
                      ]}
                    >
                      {togglingId === habit.id ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            color={habit.completedToday ? colors.success : colors.primary}
                            name={getHabitActionIcon(habit)}
                            size={16}
                          />
                          <Text
                            color={habit.completedToday ? "success" : "primary"}
                            style={styles.completeText}
                            numberOfLines={1}
                            variant="label"
                          >
                            {getHabitActionLabel(habit)}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  <View style={styles.secondaryActionsRow}>
                    <SecondaryButton
                      label="Edit"
                      onPress={() =>
                        router.push({
                          pathname: "/habit-edit",
                          params: { habitId: habit.id },
                        })
                      }
                      style={styles.editButton}
                    />

                    <Pressable
                      disabled={deletingId === habit.id}
                      onPress={() => confirmDelete(habit)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed &&
                          deletingId !== habit.id &&
                          styles.deleteButtonPressed,
                      ]}
                    >
                      {deletingId === habit.id ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            color={colors.danger}
                            name="trash-outline"
                            size={16}
                          />
                          <Text numberOfLines={1} style={styles.deleteText} variant="label">
                            Delete
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
  staticContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
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
  errorText: {
    color: colors.danger,
  },
  topControls: {
    gap: spacing.sm,
  },
  toolbarCard: {
    padding: 0,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D8E3F0",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    paddingVertical: 0,
    fontSize: 14,
  },
  searchClearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D8E3F0",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  compactCreateButton: {
    alignSelf: "flex-end",
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  filterSection: {
    gap: spacing.xs,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterChip: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D8E3F0",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  controlButtonPressed: {
    opacity: 0.8,
  },
  filterChipTextActive: {
    fontWeight: "700",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  filterModalCard: {
    gap: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  filterModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  filterModalCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  modalActions: {
    gap: spacing.sm,
  },
  emptyListWrap: {
    flex: 1,
    justifyContent: "center",
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: "#EAF2FF",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  statusChipDone: {
    backgroundColor: "#EAFBF0",
  },
  statusChipToday: {
    backgroundColor: "#EAF2FF",
  },
  actionsRow: {
    width: "100%",
    gap: spacing.sm,
  },
  negativeActionsWrap: {
    width: "100%",
    gap: 8,
  },
  negativeHint: {
    paddingHorizontal: 2,
  },
  negativeActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryActionButton: {
    width: "100%",
  },
  completeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  completeButtonDone: {
    borderColor: "#BEE8CC",
    backgroundColor: "#F1FBF5",
  },
  completeButtonDisabled: {
    opacity: 0.55,
  },
  completeButtonPressed: {
    opacity: 0.82,
  },
  negativeActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#CFE0FF",
    backgroundColor: "#F8FBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  negativeActionButtonSafe: {
    borderColor: "#BEE8CC",
    backgroundColor: "#F1FBF5",
  },
  negativeActionButtonDanger: {
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF6F7",
  },
  completeText: {
    fontWeight: "700",
  },
  negativeDangerText: {
    color: colors.danger,
    fontWeight: "700",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  editButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: "#EDF5FF",
    justifyContent: "center",
  },
  deleteButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#F5C2C7",
    backgroundColor: "#FFF6F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  deleteButtonPressed: {
    opacity: 0.75,
  },
  deleteText: {
    color: colors.danger,
  },
});
