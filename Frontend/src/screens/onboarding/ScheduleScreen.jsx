import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import BackHeader from '@/src/components/BackHeader';
import DaySelector from '@/src/components/DaySelector';
import EmptyStateCard from '@/src/components/EmptyStateCard';
import HabitPreviewCard from '@/src/components/HabitPreviewCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenContainer from '@/src/components/ScreenContainer';
import SelectCard from '@/src/components/SelectCard';
import TimePickerModal from '@/src/components/TimePickerModal';
import { FREQUENCY_OPTIONS, ONBOARDING_COPY, ONBOARDING_TOTAL_STEPS, TIME_PERIOD_OPTIONS, } from '@/src/constants/onboarding';
import { useOnboarding } from '@/src/store/OnboardingContext';
import { formatTimeLabel, getFrequencyLabel, getHabitDisplayName, isOnboardingReadyForSchedule, isSpecificDaysValid, } from '@/src/utils/onboarding';
export default function ScheduleScreen() {
    const router = useRouter();
    const { data, setFrequency, setTimeExact, setTimePeriod, toggleSpecificDay } = useOnboarding();
    const [showTimePicker, setShowTimePicker] = useState(false);
    if (!isOnboardingReadyForSchedule(data.habit_name)) {
        return (<ScreenContainer contentContainerStyle={styles.fallbackContent}>
        <EmptyStateCard actionLabel="Choose a habit" description="Your first habit has not been selected yet, so the schedule cannot be created." onAction={() => router.replace('/select-habit')} title="Pick a habit first"/>
      </ScreenContainer>);
    }
    const habitLabel = getHabitDisplayName(data.habit_name, data.habit_type);
    const reminderLabel = formatTimeLabel(data.time_exact);
    const specificDaysValid = isSpecificDaysValid(data.frequency, data.specific_days);
    return (<ScreenContainer>
      <BackHeader onBack={() => router.back()} step={4} totalSteps={ONBOARDING_TOTAL_STEPS}/>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Text variant="title">{ONBOARDING_COPY.scheduleTitle}</Text>
        <Text variant="body" color="muted">
          {ONBOARDING_COPY.scheduleDescription}
        </Text>
      </Animated.View>

      <HabitPreviewCard habitLabel={habitLabel}/>

      <View style={styles.section}>
        <Text variant="subtitle">Time</Text>
        <View style={styles.list}>
          {TIME_PERIOD_OPTIONS.map((option, index) => (<Animated.View entering={FadeInDown.duration(430).delay(index * 45)} key={option.value}>
              <SelectCard description={option.description} icon={option.icon} onPress={() => setTimePeriod(option.value)} selected={data.time_period === option.value} title={option.label}/>
            </Animated.View>))}
        </View>

        <Card style={styles.timeCard}>
          <View style={styles.timeCopy}>
            <Text variant="caption" color="muted">
              Exact reminder time
            </Text>
            <Text variant="subtitle">{reminderLabel}</Text>
          </View>
          <Pressable onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.changeButton, pressed && styles.changeButtonPressed]}>
            <Text variant="label" color="primary">
              Change time
            </Text>
          </Pressable>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle">Frequency</Text>
        <View style={styles.list}>
          {FREQUENCY_OPTIONS.map((option, index) => (<Animated.View entering={FadeInDown.duration(430).delay(index * 45)} key={option.value}>
              <SelectCard description={option.description} icon="calendar-outline" onPress={() => setFrequency(option.value)} selected={data.frequency === option.value} title={option.label}/>
            </Animated.View>))}
        </View>

        {data.frequency === 'specific_days' ? (<View style={styles.daySection}>
            <Text variant="caption" color="muted">
              Choose at least one day
            </Text>
            <DaySelector onToggle={toggleSpecificDay} selectedDays={data.specific_days}/>
            {!specificDaysValid ? (<Text variant="caption" style={styles.errorText}>
                Select at least one day to continue.
              </Text>) : null}
          </View>) : null}
      </View>

      <Card style={styles.infoCard}>
        <Text variant="caption" color="muted">
          Reminder
        </Text>
        <Text variant="body">{"We'll set a reminder for "}{reminderLabel}</Text>
        <Text variant="body" color="muted">
          {getFrequencyLabel(data.frequency, data.specific_days)}
        </Text>
      </Card>

      <PrimaryButton disabled={!specificDaysValid} label="Set My First Habit" onPress={() => router.push('/save')} style={styles.cta}/>

      <TimePickerModal initialTime={data.time_exact} onClose={() => setShowTimePicker(false)} onConfirm={(time) => {
            setTimeExact(time);
            setShowTimePicker(false);
        }} visible={showTimePicker}/>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    fallbackContent: {
        justifyContent: 'center',
    },
    header: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    section: {
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
    list: {
        gap: spacing.sm,
    },
    timeCard: {
        marginTop: spacing.xs,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    timeCopy: {
        flex: 1,
        gap: 4,
    },
    changeButton: {
        minHeight: 40,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    changeButtonPressed: {
        opacity: 0.78,
    },
    daySection: {
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    infoCard: {
        marginTop: spacing.xl,
        padding: spacing.md,
        gap: spacing.xs,
    },
    errorText: {
        color: colors.danger,
    },
    cta: {
        marginTop: spacing.xl,
    },
});

