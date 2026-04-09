import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import EmptyStateCard from "@/src/components/EmptyStateCard";
import ScreenContainer from "@/src/components/ScreenContainer";
import Card from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import { getUserAnalytics } from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
];

const HEATMAP_COLORS = {
  0: "#F3F4EE",
  1: "#D8E9AF",
  2: "#AAD45F",
  3: "#6DAA22",
  4: "#2F5F14",
};

const HEATMAP_DAY_GUIDES = [
  { label: "Mon", row: 0 },
  { label: "Tue", row: 1 },
  { label: "Wed", row: 2 },
  { label: "Thu", row: 3 },
  { label: "Fri", row: 4 },
  { label: "Sat", row: 5 },
  { label: "Sun", row: 6 },
];

function formatHabitTitle(title = "") {
  return String(title)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatMetric(stats, label, fallbackValue = 0, fallbackMax = 0) {
  const matched = stats?.find((item) => item.label === label);

  return {
    value: matched?.value ?? fallbackValue,
    max: matched?.max ?? fallbackMax,
  };
}

function buildFallbackAnalytics(days) {
  return {
    profile: null,
    range: {
      days,
      startDate: null,
      endDate: null,
    },
    summary: {
      scheduledCount: 0,
      completedCount: 0,
      missedCount: 0,
      totalExpGained: 0,
      totalHpChange: 0,
      completionRate: 0,
      activeDays: 0,
      activeHabitCount: 0,
      activeGlobalStreak: 0,
      bestHabitStreak: 0,
      dueTodayCount: 0,
      completedTodayCount: 0,
      remainingTodayCount: 0,
    },
    player: {
      level: 1,
      currentHp: 0,
      maxHp: 100,
      currentExp: 0,
      expToNextLevel: 100,
      streak: 0,
    },
    stats: [],
    activityHeatmap: {
      weeks: [],
      legend: [],
    },
    weekdayBreakdown: [],
    categoryBreakdown: [],
    streakHabits: [],
  };
}

function getHeatmapCellStyle(day) {
  const baseColor = HEATMAP_COLORS[day?.intensity ?? 0] ?? HEATMAP_COLORS[0];

  return {
    backgroundColor: baseColor,
    borderColor: day?.isToday ? "#1D4ED8" : baseColor,
  };
}

function heatmapWeeksHaveData(weeks = []) {
  return weeks.some((week) =>
    week?.days?.some((day) => (day?.completedCount ?? 0) > 0),
  );
}

function normalizeWeekdayLabel(label = "") {
  const normalizedLabel = String(label).trim().toLowerCase();
  const weekdayLabelMap = {
    t2: "Mon",
    t3: "Tue",
    t4: "Wed",
    t5: "Thu",
    t6: "Fri",
    t7: "Sat",
    cn: "Sun",
  };

  return weekdayLabelMap[normalizedLabel] ?? label;
}

function normalizeLegendLabel(label = "") {
  const normalizedLabel = String(label).trim().toLowerCase();

  if (normalizedLabel === "it") {
    return "Less";
  }

  if (normalizedLabel === "nhieu") {
    return "More";
  }

  return label;
}

function normalizeCategoryLabel(label = "") {
  return String(label).trim().toLowerCase() === "khac" ? "Other" : label;
}

function CategoryDonut({ segments }) {
  const size = 126;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  const totalPercent = segments.reduce(
    (sum, segment) => sum + Math.max(segment.percentage ?? 0, 0),
    0,
  );
  const normalizedSegments =
    totalPercent > 0
      ? segments
      : [{ label: "Other", percentage: 1, color: "#E5E7EB" }];

  return (
    <View style={styles.donutWrap}>
      <Svg height={size} width={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke="#ECE9E1"
            strokeWidth={strokeWidth}
          />
          {normalizedSegments.map((segment) => {
            const ratio =
              totalPercent > 0
                ? Math.max(segment.percentage ?? 0, 0)
                : 1;
            const dashLength = Math.max(ratio * circumference, 0);
            const circle = (
              <Circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                fill="none"
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={-runningOffset}
                strokeLinecap="butt"
                strokeWidth={strokeWidth}
              />
            );

            runningOffset += dashLength;
            return circle;
          })}
        </G>
      </Svg>

      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutCenterValue} variant="subtitle">
          {Math.round((segments[0]?.percentage ?? 0) * 100)}%
        </Text>
        <Text color="muted" style={styles.donutCenterLabel} variant="caption">
          top share
        </Text>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { completed, hydrated } = useOnboarding();
  const heatmapScrollRef = useRef(null);
  const [selectedRange, setSelectedRange] = useState(30);
  const [analytics, setAnalytics] = useState(() => buildFallbackAnalytics(30));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const hasLoadedScreenRef = useRef(false);
  const isCompactLayout = width < 430;

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

    const loadAnalytics = async () => {
      if (!hasLoadedScreenRef.current) {
        setIsLoading(true);
      }

      try {
        const result = await getUserAnalytics({ days: selectedRange });
        setAnalytics(result);
        hasLoadedScreenRef.current = true;
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load analytics right now.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, [completed, hydrated, isFocused, selectedRange]);

  useEffect(() => {
    if (!heatmapWeeksHaveData(analytics?.activityHeatmap?.weeks)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      heatmapScrollRef.current?.scrollToEnd({ animated: false });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [analytics?.activityHeatmap?.weeks, selectedRange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const result = await getUserAnalytics({
        days: selectedRange,
        forceRefresh: true,
      });
      setAnalytics(result);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to refresh analytics right now.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!hydrated || (completed && isLoading && !hasLoadedScreenRef.current)) {
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
          description="Login or create an account to unlock your analytics."
          onAction={() => router.replace("/welcome")}
          title="Analytics locked"
        />
      </ScreenContainer>
    );
  }

  const summary = analytics?.summary ?? {};
  const player = analytics?.player ?? {};
  const stats = analytics?.stats ?? [];
  const heatmapWeeks = analytics?.activityHeatmap?.weeks ?? [];
  const heatmapLegend = (analytics?.activityHeatmap?.legend ?? []).map((item) => ({
    ...item,
    label: normalizeLegendLabel(item?.label ?? ""),
  }));
  const weekdayBreakdown = (analytics?.weekdayBreakdown ?? []).map((item) => ({
    ...item,
    label: normalizeWeekdayLabel(item?.label ?? ""),
  }));
  const categoryBreakdown = (analytics?.categoryBreakdown ?? []).map((item) => ({
    ...item,
    label: normalizeCategoryLabel(item?.label ?? ""),
  }));
  const streakHabits = analytics?.streakHabits ?? [];
  const hpMetric = getStatMetric(
    stats,
    "HP",
    player?.currentHp ?? 0,
    player?.maxHp ?? 100,
  );
  const expMetric = getStatMetric(
    stats,
    "EXP",
    player?.currentExp ?? 0,
    player?.expToNextLevel ?? 100,
  );

  const maxWeekdayCount = Math.max(
    ...weekdayBreakdown.map((item) => item.completedCount ?? 0),
    1,
  );
  const maxStreakCount = Math.max(
    ...streakHabits.map((habit) => habit.currentStreak ?? 0),
    1,
  );

  return (
    <ScreenContainer
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xxl * 5 + insets.bottom },
      ]}
    >
      {loadError ? (
        <Animated.View entering={FadeInDown.duration(360).delay(20)}>
          <Card style={styles.errorCard}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
            <Text style={styles.errorText} variant="body">
              {loadError}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(320)}>
        <Card style={styles.heroCard}>
          <View style={styles.controlsRow}>
            <View style={styles.rangeRow}>
              {RANGE_OPTIONS.map((option) => {
                const selected = selectedRange === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSelectedRange(option.value)}
                    style={({ pressed }) => [
                      styles.rangePill,
                      selected && styles.rangePillSelected,
                      pressed && !selected && styles.rangePillPressed,
                    ]}
                  >
                    <Text
                      color={selected ? "white" : "muted"}
                      style={styles.rangePillText}
                      variant="label"
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={isRefreshing}
              onPress={() => void handleRefresh()}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && !isRefreshing && styles.refreshButtonPressed,
              ]}
            >
              {isRefreshing ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons color={colors.primary} name="refresh" size={18} />
              )}
            </Pressable>
          </View>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatPill}>
              <Ionicons color={colors.warning} name="flame" size={14} />
              <Text style={styles.quickStatText} variant="label">
                {player?.streak ?? 0} day streak
              </Text>
            </View>
            <View style={styles.quickStatPill}>
              <Ionicons color={colors.primary} name="flash" size={14} />
              <Text style={styles.quickStatText} variant="label">
                LV {player?.level ?? 1}
              </Text>
            </View>
            <View style={styles.quickStatPill}>
              <Ionicons color={colors.success} name="sparkles" size={14} />
              <Text style={styles.quickStatText} variant="label">
                +{summary.totalExpGained ?? 0} EXP
              </Text>
            </View>
          </View>

          <View style={styles.summaryStrip}>
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                Completion
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {Math.round((summary?.completionRate ?? 0) * 100)}%
              </Text>
            </View>
            <View style={styles.summaryStripDivider} />
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                HP
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {hpMetric.value}/{hpMetric.max}
              </Text>
            </View>
            <View style={styles.summaryStripDivider} />
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                EXP
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {expMetric.value}/{expMetric.max}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(40)}>
        <Card style={styles.heatmapCard}>
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <Text style={styles.cardTitle} variant="subtitle">
              ACTIVITY OVER THE PAST 26 WEEKS
            </Text>
            {!isCompactLayout ? (
              <Text color="muted" variant="caption">
                Contribution-style activity
              </Text>
            ) : null}
          </View>

          {heatmapWeeks.length > 0 ? (
            <>
              <View style={styles.heatmapBody}>
                <View style={styles.heatmapYAxis}>
                  {HEATMAP_DAY_GUIDES.map((guide) => (
                    <View
                      key={guide.label}
                      style={styles.heatmapYAxisItem}
                    >
                      <Text color="muted" variant="caption">
                        {guide.label}
                      </Text>
                    </View>
                  ))}
                </View>

                <ScrollView
                  ref={heatmapScrollRef}
                  contentContainerStyle={styles.heatmapScrollContent}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  <View style={styles.heatmapWeeksRow}>
                    {heatmapWeeks.map((week) => (
                      <View key={week.weekStart} style={styles.heatmapWeekColumn}>
                        {week.days.map((day) => (
                          <View
                            key={day.date}
                            style={[styles.heatmapCell, getHeatmapCellStyle(day)]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.heatmapFooter}>
                <Text color="muted" style={styles.heatmapFootnote} variant="caption">
                  Darker cells mean more completed habits on that day.
                </Text>

                <View style={styles.heatmapLegendRow}>
                  {heatmapLegend.map((item) => (
                    <View key={`${item.level}-${item.label}`} style={styles.legendPair}>
                      {item.label ? (
                        <Text color="muted" variant="caption">
                          {item.label}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.legendSquare,
                          { backgroundColor: HEATMAP_COLORS[item.level] },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <Text color="muted" variant="body">
              Complete a few habits and this activity map will start filling up.
            </Text>
          )}
        </Card>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(440).delay(70)}
        style={[styles.dualGrid, isCompactLayout && styles.dualGridStack]}
      >
        <Card style={[styles.halfCard, isCompactLayout && styles.fullCard]}>
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <Text style={styles.cardTitle} variant="subtitle">
              BY DAY OF WEEK
            </Text>
            {!isCompactLayout ? (
              <Text color="muted" variant="caption">
                Selected range
              </Text>
            ) : null}
          </View>

          <View style={styles.weekdayChart}>
            {weekdayBreakdown.map((day) => (
              <View key={day.key} style={styles.weekdayColumn}>
                <View style={styles.weekdayBarTrack}>
                  <View
                    style={[
                      styles.weekdayBar,
                      {
                        height: `${Math.max(
                          ((day.completedCount ?? 0) / maxWeekdayCount) * 100,
                          day.completedCount ? 14 : 6,
                        )}%`,
                        backgroundColor: day.color,
                      },
                    ]}
                  />
                </View>
                <Text numberOfLines={1} style={styles.weekdayLabel} variant="caption">
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={[styles.halfCard, isCompactLayout && styles.fullCard]}>
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <Text style={styles.cardTitle} variant="subtitle">
              BY CATEGORY
            </Text>
            {!isCompactLayout ? (
              <Text color="muted" variant="caption">
                Completed habit share
              </Text>
            ) : null}
          </View>

          {categoryBreakdown.length > 0 ? (
            <View
              style={[
                styles.categoryBody,
                isCompactLayout && styles.categoryBodyCompact,
              ]}
            >
              <View style={styles.categoryChartWrap}>
                <CategoryDonut segments={categoryBreakdown} />
              </View>

              <View
                style={[
                  styles.categoryLegendList,
                  isCompactLayout && styles.categoryLegendListCompact,
                ]}
              >
                {categoryBreakdown.map((category) => (
                  <View key={category.label} style={styles.categoryLegendItem}>
                    <View style={styles.categoryLegendLeft}>
                      <View
                        style={[
                          styles.categoryLegendDot,
                          { backgroundColor: category.color },
                        ]}
                      />
                      <Text numberOfLines={2} style={styles.categoryLegendLabel} variant="body">
                        {category.label}
                      </Text>
                    </View>
                    <Text style={styles.categoryPercent} variant="label">
                      {Math.round((category.percentage ?? 0) * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text color="muted" variant="body">
              Categories will appear as soon as habits are completed.
            </Text>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(480).delay(100)}>
        <Card style={styles.streakCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                HABIT STREAKS
              </Text>
              <Text color="muted" variant="caption">
                Per habit, based on its own schedule
              </Text>
            </View>
            <View style={styles.arrowBadge}>
              <Ionicons color="#64748B" name="arrow-down" size={18} />
            </View>
          </View>

          {streakHabits.length > 0 ? (
            <View style={styles.streakList}>
              {streakHabits.map((habit) => (
                <View key={habit.id} style={styles.streakRow}>
                  <View style={styles.streakTitleWrap}>
                    <Text numberOfLines={1} variant="body">
                      {formatHabitTitle(habit.title)}
                    </Text>
                  </View>

                  <View style={styles.streakBarWrap}>
                    <View style={styles.streakBarTrack}>
                      <View
                        style={[
                          styles.streakBarFill,
                          {
                            width: `${Math.max(
                              ((habit.currentStreak ?? 0) / maxStreakCount) * 100,
                              12,
                            )}%`,
                            backgroundColor: habit.color ?? colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.streakValueWrap}>
                    <Text style={styles.streakValue} variant="label">
                      {habit.currentStreak}
                    </Text>
                    <Ionicons color={colors.warning} name="flame" size={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text color="muted" variant="body">
              Build a few consecutive completions to see your streak board here.
            </Text>
          )}
        </Card>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  emptyWrap: {
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  heroCard: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: "#FBFAF6",
    borderColor: "#E6E0D5",
    borderWidth: 1,
    borderRadius: 28,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#D8D8CF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    opacity: 0.82,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangePill: {
    minWidth: 62,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D7DCD0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangePillSelected: {
    backgroundColor: "#315F12",
    borderColor: "#315F12",
  },
  rangePillPressed: {
    opacity: 0.86,
  },
  rangePillText: {
    fontWeight: "700",
  },
  quickStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E4DC",
  },
  quickStatText: {
    color: "#374151",
    fontWeight: "700",
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE7DE",
    overflow: "hidden",
  },
  summaryStripItem: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  summaryStripDivider: {
    width: 1,
    backgroundColor: "#ECE8DF",
  },
  summaryStripValue: {
    color: "#20231B",
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
  heatmapCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: "#FBFAF6",
    borderColor: "#E6E0D5",
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardHeaderStack: {
    flexDirection: "column",
  },
  cardTitle: {
    color: "#44403C",
    letterSpacing: 0.5,
  },
  heatmapBody: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  heatmapYAxis: {
    width: 34,
    gap: 4,
  },
  heatmapYAxisItem: {
    width: 34,
    height: 16,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  heatmapScrollContent: {
    paddingBottom: 4,
  },
  heatmapWeeksRow: {
    flexDirection: "row",
    gap: 4,
  },
  heatmapWeekColumn: {
    gap: 4,
  },
  heatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  heatmapFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  heatmapFootnote: {
    flex: 1,
    minWidth: 180,
  },
  heatmapLegendRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  legendPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSquare: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  dualGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dualGridStack: {
    flexDirection: "column",
  },
  halfCard: {
    flex: 1,
    minWidth: 158,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: "#FBFAF6",
    borderColor: "#E6E0D5",
    borderWidth: 1,
  },
  fullCard: {
    width: "100%",
    minWidth: 0,
  },
  weekdayChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
    minHeight: 176,
  },
  weekdayColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  weekdayBarTrack: {
    width: "100%",
    maxWidth: 32,
    height: 124,
    borderRadius: 10,
    justifyContent: "flex-end",
    backgroundColor: "#EFEEE7",
    overflow: "hidden",
  },
  weekdayBar: {
    width: "100%",
    borderRadius: 10,
  },
  weekdayLabel: {
    color: "#52525B",
    fontWeight: "700",
  },
  categoryBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  categoryBodyCompact: {
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.md,
  },
  categoryChartWrap: {
    width: 144,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  donutWrap: {
    width: 126,
    height: 126,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FBFAF6",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  donutCenterValue: {
    color: "#292524",
  },
  donutCenterLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  categoryLegendList: {
    flex: 1,
    minWidth: 0,
    gap: 12,
    paddingTop: 6,
  },
  categoryLegendListCompact: {
    width: "100%",
  },
  categoryLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 28,
  },
  categoryLegendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  categoryLegendDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  categoryLegendLabel: {
    flex: 1,
    lineHeight: 22,
  },
  categoryPercent: {
    color: "#27272A",
    fontWeight: "700",
    width: 40,
    textAlign: "right",
  },
  streakCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: "#FBFAF6",
    borderColor: "#E6E0D5",
    borderWidth: 1,
  },
  arrowBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E2DA",
    alignItems: "center",
    justifyContent: "center",
  },
  streakList: {
    gap: 14,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  streakTitleWrap: {
    width: 118,
  },
  streakBarWrap: {
    flex: 1,
  },
  streakBarTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "#ECE8DF",
    overflow: "hidden",
  },
  streakBarFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  streakValueWrap: {
    width: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  streakValue: {
    color: "#27272A",
    fontWeight: "700",
  },
});
