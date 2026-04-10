import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import EmptyStateCard from "@/src/components/EmptyStateCard";
import ScreenContainer from "@/src/components/ScreenContainer";
import Card from "@/src/components/ui/Card";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import { getUserAnalytics } from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";

const RANGE_OPTIONS = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
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

function buildFallbackAnalytics(period) {
  return {
    profile: null,
    range: {
      period,
      days: period === "day" ? 1 : period === "year" ? 365 : period === "month" ? 30 : 7,
      startDate: null,
      endDate: null,
    },
    summary: {
      scheduledCount: 0,
      successCount: 0,
      completedCount: 0,
      missedCount: 0,
      punishedCount: 0,
      avoidedCount: 0,
      failedCount: 0,
      unverifiedCount: 0,
      totalExpGained: 0,
      totalHpChange: 0,
      completionRate: 0,
      avoidanceRate: 0,
      activeDays: 0,
      activeHabitCount: 0,
      activeGlobalStreak: 0,
      bestHabitStreak: 0,
      dueTodayCount: 0,
      completedTodayCount: 0,
      remainingTodayCount: 0,
      goodHabits: {
        scheduledCount: 0,
        completedCount: 0,
        missedCount: 0,
        punishedCount: 0,
        completionRate: 0,
        dueTodayCount: 0,
        completedTodayCount: 0,
        remainingTodayCount: 0,
      },
      badHabits: {
        scheduledCount: 0,
        avoidedCount: 0,
        failedCount: 0,
        unverifiedCount: 0,
        avoidanceRate: 0,
        dueTodayCount: 0,
        avoidedTodayCount: 0,
        unverifiedTodayCount: 0,
      },
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

function buildFallbackAnalyticsMap() {
  return Object.fromEntries(
    RANGE_OPTIONS.map((option) => [option.value, buildFallbackAnalytics(option.value)]),
  );
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

function WeekdayLineChart({ data, maxCount }) {
  const [width, setWidth] = useState(0);
  const height = 160;
  const paddingLeft = 38;
  const paddingRight = 24;
  const paddingY = 32;

  if (!data || data.length === 0) return null;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingY * 2;

  const points = data.map((item, index) => {
    const x = paddingLeft + (chartWidth > 0 ? (index * chartWidth) / (data.length - 1) : 0);
    const count = item.successCount ?? item.completedCount ?? 0;
    const y = height - paddingY - (count / Math.max(maxCount, 1)) * chartHeight;
    return { x, y };
  });

  const yLabels = maxCount > 0 ? [
    { value: maxCount, y: paddingY },
    { value: Math.round(maxCount / 2), y: paddingY + chartHeight / 2 },
    { value: 0, y: height - paddingY }
  ] : [{ value: 0, y: height - paddingY }];

  // Create path using quadratic curves for smoothness
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const cp1x = (prev.x + point.x) / 2;
    return `${path} C ${cp1x} ${prev.y}, ${cp1x} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  const areaPath = width > 0 ? `${linePath} L ${points[points.length - 1].x} ${height - 10} L ${points[0].x} ${height - 10} Z` : "";

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.lineChartWrapper}
    >
      <Svg height={height} width="100%">
        <Defs>
          <LinearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.12" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {width > 0 && (
          <>
            {/* Grid Lines and Y Labels */}
            {yLabels.map((label, i) => (
              <G key={`y-${i}`}>
                <Path
                  d={`M ${paddingLeft} ${label.y} L ${width - paddingRight} ${label.y}`}
                  stroke="#E5E7EB"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <SvgText
                  alignmentBaseline="middle"
                  fill={colors.textMuted}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="end"
                  x={paddingLeft - 8}
                  y={label.y}
                >
                  {label.value}
                </SvgText>
              </G>
            ))}

            <Path d={areaPath} fill="url(#chartGradient)" />
            <Path
              d={linePath}
              fill="none"
              stroke={colors.primary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {points.map((point, index) => (
              <G key={index}>
                <Circle cx={point.x} cy={point.y} fill={colors.surface} r="4.5" stroke={colors.primary} strokeWidth="2.5" />
              </G>
            ))}
          </>
        )}
      </Svg>
      <View style={[styles.lineChartLabels, { paddingLeft: paddingLeft, paddingRight: paddingRight }]}>
        {data.map((item, index) => (
          <Text key={index} color="muted" style={styles.lineChartLabelText} variant="caption">
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
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
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { completed, hydrated } = useOnboarding();
  const heatmapScrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [selectedRanges, setSelectedRanges] = useState({
    overview: "month",
    weekday: "week",
    category: "month",
    completions: "month",
  });
  const [analyticsByPeriod, setAnalyticsByPeriod] = useState(() =>
    buildFallbackAnalyticsMap(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isCompletionsExpanded, setIsCompletionsExpanded] = useState(false);
  const [isStreaksExpanded, setIsStreaksExpanded] = useState(false);
  const hasLoadedScreenRef = useRef(false);
  const isCompactLayout = width < 430;

  const loadAnalyticsBundle = async (options = {}) => {
    const results = await Promise.all(
      RANGE_OPTIONS.map(async (option) => [
        option.value,
        await getUserAnalytics({
          period: option.value,
          forceRefresh: options.forceRefresh ?? false,
        }),
      ]),
    );

    return Object.fromEntries(results);
  };

  const setChartRange = (chartKey, period) => {
    setSelectedRanges((currentRanges) => ({
      ...currentRanges,
      [chartKey]: period,
    }));
  };

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
        const results = await loadAnalyticsBundle();
        setAnalyticsByPeriod(results);
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
  }, [completed, hydrated, isFocused]);

  const heatmapAnalytics = analyticsByPeriod.year ?? buildFallbackAnalytics("year");
  const overviewAnalytics =
    analyticsByPeriod[selectedRanges.overview] ??
    buildFallbackAnalytics(selectedRanges.overview);
  const weekdayAnalytics =
    analyticsByPeriod[selectedRanges.weekday] ??
    buildFallbackAnalytics(selectedRanges.weekday);
  const categoryAnalytics =
    analyticsByPeriod[selectedRanges.category] ??
    buildFallbackAnalytics(selectedRanges.category);
  const completionAnalytics =
    analyticsByPeriod[selectedRanges.completions] ??
    buildFallbackAnalytics(selectedRanges.completions);

  useEffect(() => {
    if (!heatmapWeeksHaveData(heatmapAnalytics?.activityHeatmap?.weeks)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      heatmapScrollRef.current?.scrollToEnd({ animated: false });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [heatmapAnalytics?.activityHeatmap?.weeks]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const results = await loadAnalyticsBundle({ forceRefresh: true });
      setAnalyticsByPeriod(results);
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

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", (e) => {
      if (isFocused) {
        e.preventDefault();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        void handleRefresh();
      }
    });
    return unsubscribe;
  }, [navigation, isFocused]);

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

  const summary = overviewAnalytics?.summary ?? {};
  const goodSummary = summary?.goodHabits ?? {};
  const badSummary = summary?.badHabits ?? {};
  const player = overviewAnalytics?.player ?? {};
  const stats = overviewAnalytics?.stats ?? [];
  const heatmapWeeks = heatmapAnalytics?.activityHeatmap?.weeks ?? [];
  const heatmapLegend = (heatmapAnalytics?.activityHeatmap?.legend ?? []).map((item) => ({
    ...item,
    label: normalizeLegendLabel(item?.label ?? ""),
  }));
  const weekdayBreakdown = (weekdayAnalytics?.weekdayBreakdown ?? []).map((item) => ({
    ...item,
    label: normalizeWeekdayLabel(item?.label ?? ""),
  }));
  const categoryBreakdown = (categoryAnalytics?.categoryBreakdown ?? []).map((item) => ({
    ...item,
    label: normalizeCategoryLabel(item?.label ?? ""),
  }));
  const streakHabits =
    analyticsByPeriod.year?.streakHabits ??
    analyticsByPeriod.month?.streakHabits ??
    overviewAnalytics?.streakHabits ??
    [];
  const topHabits = completionAnalytics?.topHabits ?? [];
  const expMetric = getStatMetric(
    stats,
    "EXP",
    player?.currentExp ?? 0,
    player?.expToNextLevel ?? 100,
  );

  const maxWeekdayCount = Math.max(
    ...weekdayBreakdown.map((item) => item.successCount ?? item.completedCount ?? 0),
    1,
  );
  const maxStreakCount = Math.max(
    ...streakHabits.map((habit) => habit.currentStreak ?? 0),
    1,
  );
  const maxCompletionCount = Math.max(
    ...topHabits.map((habit) => habit.successCount ?? 0),
    1,
  );

  const displayCompletions = isCompletionsExpanded ? topHabits : topHabits.slice(0, 5);
  const displayStreaks = isStreaksExpanded ? streakHabits : streakHabits.slice(0, 5);

  const renderRangeSelector = (selectedRange, onSelectRange) => (
    <View style={[styles.rangeRow, isCompactLayout && styles.rangeRowWrap]}>
      {RANGE_OPTIONS.map((option) => {
        const selected = selectedRange === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onSelectRange(option.value)}
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
  );

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          colors={[colors.primary]}
          onRefresh={() => void handleRefresh()}
          refreshing={isRefreshing}
          tintColor={colors.primary}
        />
      }
      scrollViewRef={scrollViewRef}
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
            {renderRangeSelector(selectedRanges.overview, (period) =>
              setChartRange("overview", period),
            )}
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
            <View style={styles.quickStatPill}>
              <Ionicons color="#B45309" name="shield-checkmark" size={14} />
              <Text style={styles.quickStatText} variant="label">
                {Math.round((badSummary.avoidanceRate ?? 0) * 100)}% avoid
              </Text>
            </View>
          </View>

          <View style={styles.summaryStrip}>
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                Good habits
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {Math.round((goodSummary?.completionRate ?? 0) * 100)}%
              </Text>
            </View>
            <View style={styles.summaryStripDivider} />
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                Bad habits
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {Math.round((badSummary?.avoidanceRate ?? 0) * 100)}%
              </Text>
            </View>
            <View style={styles.summaryStripDivider} />
            <View style={styles.summaryStripItem}>
                <Text color="muted" variant="caption">
                  EXP gained
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
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                ACTIVITY OVER THE PAST 26 WEEKS
              </Text>
              {!isCompactLayout ? (
                <Text color="muted" variant="caption">
                  Contribution-style activity
                </Text>
              ) : null}
            </View>
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
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                BY DAY OF WEEK
              </Text>
              <Text color="muted" style={styles.chartDescription} variant="caption">
                Biểu đồ này thống kê tần suất hoàn thành thói quen theo từng ngày trong tuần, giúp bạn nhận biết ngày nào mình hoạt động hiệu quả nhất.
              </Text>
            </View>
            {renderRangeSelector(selectedRanges.weekday, (period) =>
              setChartRange("weekday", period),
            )}
          </View>

          <WeekdayLineChart data={weekdayBreakdown} maxCount={maxWeekdayCount} />
        </Card>

        <Card style={[styles.halfCard, isCompactLayout && styles.fullCard]}>
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                BY CATEGORY
              </Text>
              {!isCompactLayout ? (
                <Text color="muted" variant="caption">
                  Successful log share
                </Text>
              ) : null}
            </View>
            {renderRangeSelector(selectedRanges.category, (period) =>
              setChartRange("category", period),
            )}
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
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                HABIT COMPLETIONS
              </Text>
              <Text color="muted" variant="caption">
                Successful check-ins for each habit in the selected period
              </Text>
            </View>
            {renderRangeSelector(selectedRanges.completions, (period) =>
              setChartRange("completions", period),
            )}
          </View>

          {topHabits.length > 0 ? (
            <View style={styles.streakList}>
              {displayCompletions.map((habit) => {
                const habitCount =
                  habit.habitType === "negative"
                    ? habit.avoidedCount ?? habit.successCount ?? 0
                    : habit.completedCount ?? habit.successCount ?? 0;

                return (
                  <View key={habit.id} style={styles.streakRow}>
                    <View style={styles.streakTitleWrap}>
                      <Text numberOfLines={1} variant="body">
                        {formatHabitTitle(habit.title)}
                      </Text>
                      <Text color="muted" variant="caption">
                        {habit.habitType === "negative"
                          ? "Avoided in period"
                          : "Completed in period"}
                      </Text>
                    </View>

                    <View style={styles.streakBarWrap}>
                      <View style={styles.streakBarTrack}>
                        <View
                          style={[
                            styles.streakBarFill,
                            {
                              width: `${Math.max(
                                (habitCount / maxCompletionCount) * 100,
                                habitCount > 0 ? 12 : 0,
                              )}%`,
                              backgroundColor:
                                habit.habitType === "negative" ? "#B45309" : colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.completionValueWrap}>
                      <Text style={styles.streakValue} variant="label">
                        {habitCount}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {topHabits.length > 5 && (
                <Pressable
                  onPress={() => setIsCompletionsExpanded(!isCompletionsExpanded)}
                  style={({ pressed }) => [
                    styles.expandButton,
                    pressed && styles.expandButtonPressed,
                  ]}
                >
                  <Text style={styles.expandButtonText}>
                    {isCompletionsExpanded ? "Show less" : "More habits"}
                  </Text>
                  <Ionicons
                    color={colors.primary}
                    name={isCompletionsExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                  />
                </Pressable>
              )}
            </View>
          ) : (
            <Text color="muted" variant="body">
              Complete a few habits in this period to populate the chart.
            </Text>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(520).delay(120)}>
        <Card style={styles.streakCard}>
          <View style={[styles.cardHeader, isCompactLayout && styles.cardHeaderStack]}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                HABIT STREAKS
              </Text>
              <Text color="muted" variant="caption">
                Per habit, based on its own schedule
              </Text>
            </View>
          </View>

          {streakHabits.length > 0 ? (
            <View style={styles.streakList}>
              {displayStreaks.map((habit) => (
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

              {streakHabits.length > 5 && (
                <Pressable
                  onPress={() => setIsStreaksExpanded(!isStreaksExpanded)}
                  style={({ pressed }) => [
                    styles.expandButton,
                    pressed && styles.expandButtonPressed,
                  ]}
                >
                  <Text style={styles.expandButtonText}>
                    {isStreaksExpanded ? "Show less" : "More habits"}
                  </Text>
                  <Ionicons
                    color={colors.primary}
                    name={isStreaksExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                  />
                </Pressable>
              )}
            </View>
          ) : (
            <Text color="muted" variant="body">
              Build a few consecutive successful days to see your streak board here.
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
  rangeRowWrap: {
    flexWrap: "wrap",
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
  cardHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
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
  completionValueWrap: {
    width: 36,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  streakValue: {
    color: "#27272A",
    fontWeight: "700",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E4DC",
    backgroundColor: "#FFFFFF",
  },
  expandButtonPressed: {
    backgroundColor: "#F9F9F7",
  },
  expandButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  chartDescription: {
    marginTop: 2,
    lineHeight: 16,
    maxWidth: "90%",
  },
  lineChartWrapper: {
    marginTop: spacing.sm,
    width: "100%",
  },
  lineChartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -10,
  },
  lineChartLabelText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
