import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { generateAnalyticsReport } from "@/src/services/ai.service";
import { getUserAnalytics, getUserAnalyticsBundle } from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import { buildAnalyticsReportHtml } from "@/src/utils/analyticsPdf";

const RANGE_OPTIONS = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const HEATMAP_COLORS = {
  0: "#F1F5F9",
  1: "#DBEAFE",
  2: "#93C5FD",
  3: "#2563EB",
  4: "#1E3A8A",
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

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const ANALYTICS_COLORS = {
  cardBackground: "#F8FBFF",
  cardBorder: "#D6E2F6",
  panelBackground: "#FFFFFF",
  panelSoftBackground: "#EEF5FF",
  pillBorder: "#D7E5FB",
  divider: "#DCE6F2",
  track: "#EEF3FA",
  trackMuted: "#E6EEF8",
  textStrong: "#1E293B",
  textSoft: "#475569",
  textMuted: "#64748B",
  textDanger: "#9F1239",
  heatmapOutOfRangeBackground: "#F8FAFC",
  heatmapOutOfRangeBorder: "#D8E2EE",
  heatmapTodayBorder: "#1E40AF",
  heatmapEmptyBackground: "#EDF5FF",
  heatmapEmptyBorder: "#CFE0FF",
};

function getCurrentCalendarYear() {
  return new Date().getFullYear();
}

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

function getRequiredAnalyticsPeriods(selectedRanges) {
  return [...new Set([
    selectedRanges.overview,
    selectedRanges.weekday,
    selectedRanges.category,
    selectedRanges.completions,
    "year",
  ])];
}

function getHeatmapCellStyle(day) {
  if (!day?.isInRange) {
    return {
      backgroundColor: ANALYTICS_COLORS.heatmapOutOfRangeBackground,
      borderColor: ANALYTICS_COLORS.heatmapOutOfRangeBorder,
      opacity: 0.55,
    };
  }

  const baseColor = HEATMAP_COLORS[day?.intensity ?? 0] ?? HEATMAP_COLORS[0];

  return {
    backgroundColor: baseColor,
    borderColor: day?.isToday ? ANALYTICS_COLORS.heatmapTodayBorder : baseColor,
  };
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

function heatmapHasSuccessData(weeks = []) {
  return weeks.some((week) =>
    week?.days?.some((day) => (day?.successCount ?? 0) > 0),
  );
}

function formatAnalyticsDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  // Safely parse YYYY-MM-DD locally to avoid React Native JSC/Hermes parsing NaN
  const parts = dateValue.split("-").map(Number);
  if (parts.length !== 3) {
    return null;
  }
  
  const [year, month, day] = parts;
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return LONG_DATE_FORMATTER.format(parsedDate);
}

function formatHeatmapDateRange(activityHeatmap = {}) {
  const formattedStartDate = formatAnalyticsDate(activityHeatmap?.startDate);
  const formattedEndDate = formatAnalyticsDate(activityHeatmap?.endDate);

  if (formattedStartDate && formattedEndDate) {
    return `${formattedStartDate} - ${formattedEndDate}`;
  }

  return "From the start of the selected year to the latest tracked day";
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
                  stroke={ANALYTICS_COLORS.divider}
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
      : [{ label: "Other", percentage: 1, color: ANALYTICS_COLORS.trackMuted }];

  return (
    <View style={styles.donutWrap}>
      <Svg height={size} width={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={ANALYTICS_COLORS.track}
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
  const { completed, hydrated, userProfile } = useOnboarding();
  const currentCalendarYear = getCurrentCalendarYear();
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
  const [heatmapAnalyticsByYear, setHeatmapAnalyticsByYear] = useState({});
  const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(currentCalendarYear);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHeatmapYearLoading, setIsHeatmapYearLoading] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState({});
  const [loadedPeriods, setLoadedPeriods] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [isCompletionsExpanded, setIsCompletionsExpanded] = useState(false);
  const [isStreaksExpanded, setIsStreaksExpanded] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const hasLoadedScreenRef = useRef(false);
  const isPhoneLayout = width < 768;
  const isCompactLayout = width < 520;
  const isNarrowLayout = width < 390;
  const shouldStackHeaderControls = width < 560;
  const shouldStackSummaryStrip = width < 460;

  const loadAnalyticsBundle = useCallback(
    async (options = {}) =>
      getUserAnalyticsBundle({
        periods: getRequiredAnalyticsPeriods(selectedRanges),
        year: currentCalendarYear,
        forceRefresh: options.forceRefresh ?? false,
      }),
    [currentCalendarYear, selectedRanges],
  );

  const mergeAnalyticsResults = useCallback((results) => {
    const resultEntries = Object.entries(results ?? {});

    if (resultEntries.length === 0) {
      return;
    }

    setAnalyticsByPeriod((currentAnalytics) => ({
      ...currentAnalytics,
      ...Object.fromEntries(resultEntries),
    }));
    setLoadedPeriods((currentLoadedPeriods) => ({
      ...currentLoadedPeriods,
      ...Object.fromEntries(resultEntries.map(([period]) => [period, true])),
    }));
  }, []);

  const ensureAnalyticsPeriodLoaded = useCallback(
    async (period, options = {}) => {
      if (!period || (loadedPeriods[period] && !options.forceRefresh)) {
        return;
      }

      setLoadingPeriods((currentLoadingPeriods) => {
        if (currentLoadingPeriods[period]) {
          return currentLoadingPeriods;
        }

        return {
          ...currentLoadingPeriods,
          [period]: true,
        };
      });

      try {
        const analytics = await getUserAnalytics({
          period,
          year: period === "year" ? currentCalendarYear : undefined,
          forceRefresh: options.forceRefresh ?? false,
        });

        setAnalyticsByPeriod((currentAnalytics) => ({
          ...currentAnalytics,
          [period]: analytics,
        }));
        setLoadedPeriods((currentLoadedPeriods) => ({
          ...currentLoadedPeriods,
          [period]: true,
        }));
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load analytics right now.",
        );
      } finally {
        setLoadingPeriods((currentLoadingPeriods) => ({
          ...currentLoadingPeriods,
          [period]: false,
        }));
      }
    },
    [currentCalendarYear, loadedPeriods],
  );

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
        mergeAnalyticsResults(results);
        const resolvedHeatmapYear =
          results?.year?.activityHeatmap?.selectedYear ?? currentCalendarYear;
        setHeatmapAnalyticsByYear((currentCache) => ({
          ...currentCache,
          [resolvedHeatmapYear]: results.year,
        }));
        setSelectedHeatmapYear((currentYear) => {
          const availableYears =
            results?.year?.activityHeatmap?.availableYears ?? [resolvedHeatmapYear];

          return availableYears.includes(currentYear)
            ? currentYear
            : resolvedHeatmapYear;
        });
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
  }, [
    completed,
    currentCalendarYear,
    hydrated,
    isFocused,
    loadAnalyticsBundle,
    mergeAnalyticsResults,
  ]);

  useEffect(() => {
    if (!hasLoadedScreenRef.current) {
      return;
    }

    const selectedPeriods = [
      selectedRanges.overview,
      selectedRanges.weekday,
      selectedRanges.category,
      selectedRanges.completions,
    ];

    selectedPeriods.forEach((period) => {
      if (!loadedPeriods[period] && !loadingPeriods[period]) {
        void ensureAnalyticsPeriodLoaded(period);
      }
    });
  }, [
    ensureAnalyticsPeriodLoaded,
    loadedPeriods,
    loadingPeriods,
    selectedRanges.category,
    selectedRanges.completions,
    selectedRanges.overview,
    selectedRanges.weekday,
  ]);

  const currentYearAnalytics = analyticsByPeriod.year ?? buildFallbackAnalytics("year");
  const heatmapAnalytics =
    heatmapAnalyticsByYear[selectedHeatmapYear] ??
    (selectedHeatmapYear ===
    (currentYearAnalytics?.activityHeatmap?.selectedYear ?? currentCalendarYear)
      ? currentYearAnalytics
      : null);
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
    if (
      !hydrated ||
      !completed ||
      !isFocused ||
      !selectedHeatmapYear ||
      heatmapAnalyticsByYear[selectedHeatmapYear]
    ) {
      return;
    }

    let isCancelled = false;

    const loadHeatmapYear = async () => {
      setIsHeatmapYearLoading(true);

      try {
        const analytics = await getUserAnalytics({
          period: "year",
          year: selectedHeatmapYear,
        });

        if (isCancelled) {
          return;
        }

        setHeatmapAnalyticsByYear((currentCache) => ({
          ...currentCache,
          [selectedHeatmapYear]: analytics,
        }));
      } catch (error) {
        if (!isCancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load the selected heatmap year right now.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsHeatmapYearLoading(false);
        }
      }
    };

    void loadHeatmapYear();

    return () => {
      isCancelled = true;
    };
  }, [
    completed,
    heatmapAnalyticsByYear,
    hydrated,
    isFocused,
    selectedHeatmapYear,
  ]);

  useEffect(() => {
    if (!heatmapAnalytics?.activityHeatmap?.weeks?.length) {
      return;
    }

    const timeoutId = setTimeout(() => {
      heatmapScrollRef.current?.scrollTo({ x: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [heatmapAnalytics?.activityHeatmap?.selectedYear, heatmapAnalytics?.activityHeatmap?.weeks]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const results = await loadAnalyticsBundle({ forceRefresh: true });
      const resolvedHeatmapYear =
        results?.year?.activityHeatmap?.selectedYear ?? currentCalendarYear;
      mergeAnalyticsResults(results);
      setHeatmapAnalyticsByYear((currentCache) => ({
        ...currentCache,
        [resolvedHeatmapYear]: results.year,
      }));

      if (selectedHeatmapYear && selectedHeatmapYear !== resolvedHeatmapYear) {
        const selectedYearAnalytics = await getUserAnalytics({
          period: "year",
          year: selectedHeatmapYear,
          forceRefresh: true,
        });

        setHeatmapAnalyticsByYear((currentCache) => ({
          ...currentCache,
          [selectedHeatmapYear]: selectedYearAnalytics,
        }));
      }

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
  }, [currentCalendarYear, loadAnalyticsBundle, mergeAnalyticsResults, selectedHeatmapYear]);

  const handleExportPdf = useCallback(async () => {
    if (isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const period = selectedRanges.overview ?? "week";
      const response = await generateAnalyticsReport(period, userProfile);
      const html = buildAnalyticsReportHtml({
        report: response?.report,
        analytics: response?.analytics ?? analyticsByPeriod[period] ?? overviewAnalytics,
        period,
      });
      const pdf = await Print.printToFileAsync({
        html,
        base64: false,
      });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert("PDF ready", `Report saved at: ${pdf.uri}`);
        return;
      }

      await Sharing.shareAsync(pdf.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share analytics report",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert(
        "Unable to export PDF",
        error instanceof Error
          ? error.message
          : "Please check the Gemini report API configuration, then try again.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    analyticsByPeriod,
    isExportingPdf,
    overviewAnalytics,
    selectedRanges.overview,
    userProfile,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", (e) => {
      if (isFocused) {
        e.preventDefault();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        void handleRefresh();
      }
    });
    return unsubscribe;
  }, [handleRefresh, isFocused, navigation]);

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
  const heatmapYears = [...new Set([
    ...(currentYearAnalytics?.activityHeatmap?.availableYears ?? []),
    ...(heatmapAnalytics?.activityHeatmap?.availableYears ?? []),
    currentCalendarYear,
  ])].sort((leftYear, rightYear) => rightYear - leftYear);
  const heatmapWeeks = heatmapAnalytics?.activityHeatmap?.weeks ?? [];
  const hasHeatmapSuccessData = heatmapHasSuccessData(heatmapWeeks);
  const heatmapRangeLabel = formatHeatmapDateRange(heatmapAnalytics?.activityHeatmap);
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
    <View
      style={[
        styles.rangeRow,
        isCompactLayout && styles.rangeRowWrap,
        isNarrowLayout && styles.rangeRowFill,
      ]}
    >
      {RANGE_OPTIONS.map((option) => {
        const selected = selectedRange === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onSelectRange(option.value)}
            style={({ pressed }) => [
              styles.rangePill,
              isCompactLayout && styles.rangePillCompact,
              isNarrowLayout && styles.rangePillFill,
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

  const renderSectionLoadingBadge = (period) =>
    loadingPeriods[period] ? (
      <View style={styles.sectionLoadingBadge}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    ) : null;

  const renderHeatmapYearSelector = () => (
    <View
      style={[
        styles.yearSelectorRow,
        isCompactLayout && styles.rangeRowWrap,
        shouldStackHeaderControls && styles.yearSelectorRowStack,
      ]}
    >
      {heatmapYears.map((year) => {
        const selected = selectedHeatmapYear === year;

        return (
          <Pressable
            key={year}
            onPress={() => setSelectedHeatmapYear(year)}
            style={({ pressed }) => [
              styles.yearPill,
              selected && styles.yearPillSelected,
              pressed && !selected && styles.rangePillPressed,
            ]}
          >
            <Text
              color={selected ? "white" : "muted"}
              style={styles.rangePillText}
              variant="label"
            >
              {year}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderRangeControls = (selectedRange, period, chartKey) => (
    <View
      style={[
        styles.headerControls,
        shouldStackHeaderControls && styles.headerControlsStack,
      ]}
    >
      {renderSectionLoadingBadge(period)}
      {renderRangeSelector(selectedRange, (nextPeriod) =>
        setChartRange(chartKey, nextPeriod),
      )}
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
          <View style={[styles.controlsRow, isCompactLayout && styles.controlsRowStack]}>
            {renderRangeSelector(selectedRanges.overview, (period) =>
              setChartRange("overview", period),
            )}
            {renderSectionLoadingBadge(selectedRanges.overview)}
            <Pressable
              disabled={isExportingPdf}
              onPress={() => void handleExportPdf()}
              style={({ pressed }) => [
                styles.exportButton,
                pressed && styles.exportButtonPressed,
                isExportingPdf && styles.exportButtonDisabled,
              ]}
            >
              {isExportingPdf ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Ionicons color={colors.surface} name="document-text-outline" size={16} />
              )}
              <Text color="white" style={styles.exportButtonText} variant="label">
                {isExportingPdf ? "Exporting" : "Export PDF"}
              </Text>
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
            <View style={styles.quickStatPill}>
              <Ionicons color="#B45309" name="shield-checkmark" size={14} />
              <Text style={styles.quickStatText} variant="label">
                {Math.round((badSummary.avoidanceRate ?? 0) * 100)}% avoid
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryStrip,
              shouldStackSummaryStrip && styles.summaryStripStack,
            ]}
          >
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                Good habits
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {Math.round((goodSummary?.completionRate ?? 0) * 100)}%
              </Text>
            </View>
            <View
              style={[
                styles.summaryStripDivider,
                shouldStackSummaryStrip && styles.summaryStripDividerHorizontal,
              ]}
            />
            <View style={styles.summaryStripItem}>
              <Text color="muted" variant="caption">
                Bad habits
              </Text>
              <Text style={styles.summaryStripValue} variant="subtitle">
                {Math.round((badSummary?.avoidanceRate ?? 0) * 100)}%
              </Text>
            </View>
            <View
              style={[
                styles.summaryStripDivider,
                shouldStackSummaryStrip && styles.summaryStripDividerHorizontal,
              ]}
            />
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
          <View
            style={[
              styles.cardHeader,
              shouldStackHeaderControls && styles.cardHeaderStack,
            ]}
          >
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                YEARLY ACTIVITY MAP
              </Text>
              <Text color="muted" variant="caption">
                {heatmapRangeLabel}
              </Text>
            </View>
            {renderHeatmapYearSelector()}
          </View>

          {isHeatmapYearLoading && !heatmapAnalytics ? (
            <View style={styles.heatmapLoadingWrap}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text color="muted" variant="body">
                Loading year {selectedHeatmapYear}...
              </Text>
            </View>
          ) : heatmapWeeks.length > 0 ? (
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
                  onContentSizeChange={() => {
                    heatmapScrollRef.current?.scrollToEnd({ animated: false });
                  }}
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
                  Darker cells mean more successful habits on that day. Empty faded cells are outside the selected year range.
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

              {!hasHeatmapSuccessData ? (
                <View style={styles.heatmapEmptyNotice}>
                  <Ionicons color={colors.primary} name="sparkles-outline" size={16} />
                  <Text color="muted" style={styles.heatmapEmptyNoticeText} variant="caption">
                    No successful habit days have been recorded for {selectedHeatmapYear} yet.
                  </Text>
                </View>
              ) : null}
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
        style={[styles.dualGrid, isPhoneLayout && styles.dualGridStack]}
      >
        <Card style={[styles.halfCard, isPhoneLayout && styles.fullCard]}>
          <View
            style={[
              styles.cardHeader,
              shouldStackHeaderControls && styles.cardHeaderStack,
            ]}
          >
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                BY DAY OF WEEK
              </Text>
              <Text color="muted" style={styles.chartDescription} variant="caption">
                See which weekdays you complete habits most often and spot the days when your routine is strongest.
              </Text>
            </View>
            {renderRangeControls(
              selectedRanges.weekday,
              selectedRanges.weekday,
              "weekday",
            )}
          </View>

          <WeekdayLineChart data={weekdayBreakdown} maxCount={maxWeekdayCount} />
        </Card>

        <Card style={[styles.halfCard, isPhoneLayout && styles.fullCard]}>
          <View
            style={[
              styles.cardHeader,
              shouldStackHeaderControls && styles.cardHeaderStack,
            ]}
          >
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                BY CATEGORY
              </Text>
              <Text color="muted" variant="caption">
                Successful log share
              </Text>
            </View>
            {renderRangeControls(
              selectedRanges.category,
              selectedRanges.category,
              "category",
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
          <View
            style={[
              styles.cardHeader,
              shouldStackHeaderControls && styles.cardHeaderStack,
            ]}
          >
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle} variant="subtitle">
                HABIT COMPLETIONS
              </Text>
              <Text color="muted" variant="caption">
                Successful check-ins for each habit in the selected period
              </Text>
            </View>
            {renderRangeControls(
              selectedRanges.completions,
              selectedRanges.completions,
              "completions",
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
          <View
            style={[
              styles.cardHeader,
              shouldStackHeaderControls && styles.cardHeaderStack,
            ]}
          >
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
    backgroundColor: ANALYTICS_COLORS.cardBackground,
    borderColor: ANALYTICS_COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 28,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  controlsRowStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sectionLoadingBadge: {
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.pillBorder,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    opacity: 0.82,
  },
  exportButton: {
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportButtonPressed: {
    opacity: 0.86,
  },
  exportButtonDisabled: {
    opacity: 0.68,
  },
  exportButtonText: {
    fontWeight: "700",
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangeRowWrap: {
    flexWrap: "wrap",
    width: "100%",
  },
  rangeRowFill: {
    justifyContent: "space-between",
  },
  rangePill: {
    minWidth: 62,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.pillBorder,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangePillCompact: {
    minWidth: 0,
  },
  rangePillFill: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  rangePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.cardBorder,
  },
  quickStatText: {
    color: ANALYTICS_COLORS.textSoft,
    fontWeight: "700",
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 24,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.cardBorder,
    overflow: "hidden",
  },
  summaryStripStack: {
    flexDirection: "column",
  },
  summaryStripItem: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  summaryStripDivider: {
    width: 1,
    backgroundColor: ANALYTICS_COLORS.divider,
  },
  summaryStripDividerHorizontal: {
    width: "100%",
    height: 1,
  },
  summaryStripValue: {
    color: ANALYTICS_COLORS.textStrong,
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
    color: ANALYTICS_COLORS.textDanger,
  },
  heatmapCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: ANALYTICS_COLORS.cardBackground,
    borderColor: ANALYTICS_COLORS.cardBorder,
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
    alignItems: "stretch",
  },
  cardHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    flexShrink: 1,
  },
  headerControlsStack: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  cardTitle: {
    color: ANALYTICS_COLORS.textStrong,
    letterSpacing: 0.5,
  },
  heatmapBody: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  yearSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  yearSelectorRowStack: {
    width: "100%",
    justifyContent: "flex-start",
  },
  yearPill: {
    minWidth: 72,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.pillBorder,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  yearPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  heatmapLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  heatmapEmptyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: ANALYTICS_COLORS.heatmapEmptyBackground,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.heatmapEmptyBorder,
  },
  heatmapEmptyNoticeText: {
    flex: 1,
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
    backgroundColor: ANALYTICS_COLORS.cardBackground,
    borderColor: ANALYTICS_COLORS.cardBorder,
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
    backgroundColor: ANALYTICS_COLORS.trackMuted,
    overflow: "hidden",
  },
  weekdayBar: {
    width: "100%",
    borderRadius: 10,
  },
  weekdayLabel: {
    color: ANALYTICS_COLORS.textSoft,
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
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  donutCenterValue: {
    color: ANALYTICS_COLORS.textStrong,
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
    color: ANALYTICS_COLORS.textStrong,
    fontWeight: "700",
    width: 40,
    textAlign: "right",
  },
  streakCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: ANALYTICS_COLORS.cardBackground,
    borderColor: ANALYTICS_COLORS.cardBorder,
    borderWidth: 1,
  },
  arrowBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
    borderWidth: 1,
    borderColor: ANALYTICS_COLORS.cardBorder,
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
    backgroundColor: ANALYTICS_COLORS.track,
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
    color: ANALYTICS_COLORS.textStrong,
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
    borderColor: ANALYTICS_COLORS.cardBorder,
    backgroundColor: ANALYTICS_COLORS.panelBackground,
  },
  expandButtonPressed: {
    backgroundColor: ANALYTICS_COLORS.panelSoftBackground,
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
