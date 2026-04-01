import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
import BackHeader from '@/src/components/BackHeader';
import EmptyStateCard from '@/src/components/EmptyStateCard';
import HabitPreviewCard from '@/src/components/HabitPreviewCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenContainer from '@/src/components/ScreenContainer';
import SecondaryButton from '@/src/components/SecondaryButton';
import { ONBOARDING_COPY, ONBOARDING_TOTAL_STEPS } from '@/src/constants/onboarding';
import { useOnboarding } from '@/src/store/OnboardingContext';
import { formatTimeLabel, getFrequencyLabel, getHabitDisplayName, isOnboardingReadyForSave, } from '@/src/utils/onboarding';
export default function SaveProgressScreen() {
    const router = useRouter();
    const { completeGettingStarted, completed, data } = useOnboarding();
    if (!isOnboardingReadyForSave(data.habit_name)) {
        return (<ScreenContainer contentContainerStyle={styles.fallbackContent}>
        <EmptyStateCard actionLabel="Finish schedule" description="There is no habit ready to save yet, so this final step needs your schedule first." onAction={() => router.replace('/schedule')} title="Schedule your habit first"/>
      </ScreenContainer>);
    }
    const habitLabel = getHabitDisplayName(data.habit_name, data.habit_type);
    const timeLabel = `${data.time_period[0].toUpperCase()}${data.time_period.slice(1)} at ${formatTimeLabel(data.time_exact)}`;
    const frequencyLabel = getFrequencyLabel(data.frequency, data.specific_days);
    const handleContinue = () => {
        if (completed) {
            router.replace('/(tabs)');
            return;
        }
        completeGettingStarted();
        router.push({ pathname: '/sign-in', params: { source: 'onboarding' } });
    };
    return (<ScreenContainer>
      <BackHeader onBack={() => router.back()} step={5} totalSteps={ONBOARDING_TOTAL_STEPS}/>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.illustration}>
        <View style={styles.illustrationOuter}>
          <View style={styles.illustrationMiddle}>
            <View style={styles.illustrationInner}>
              <Ionicons color={colors.primary} name="cloud-upload-outline" size={40}/>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(470).delay(30)} style={styles.header}>
        <Text variant="title">{completed ? 'Your habit plan is updated' : ONBOARDING_COPY.saveTitle}</Text>
        <Text variant="body" color="muted">
          {completed
            ? 'Your dashboard will refresh with this routine as soon as you head back.'
            : ONBOARDING_COPY.saveDescription}
        </Text>
      </Animated.View>

      <HabitPreviewCard frequencyLabel={frequencyLabel} habitLabel={habitLabel} timeLabel={timeLabel}/>

      <View style={styles.nextCard}>
        <Text variant="subtitle">{completed ? 'Back to dashboard' : 'Next up: Login or Sign Up'}</Text>
        <Text variant="body" color="muted">
          {completed
            ? 'Keep your streak going from the main dashboard.'
            : 'Getting Started is complete. The next screen lets you login or create an account to enter HabitForge.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton icon={<Ionicons color={colors.surface} name={completed ? 'grid-outline' : 'log-in-outline'} size={18}/>} label={completed ? 'Open Dashboard' : 'Continue to Login'} onPress={handleContinue}/>
        <SecondaryButton label="Back to schedule" onPress={() => router.back()}/>
      </View>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    fallbackContent: {
        justifyContent: 'center',
    },
    illustration: {
        alignItems: 'center',
        marginTop: spacing.md,
    },
    illustrationOuter: {
        width: 184,
        height: 184,
        borderRadius: 92,
        backgroundColor: '#EAF3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    illustrationMiddle: {
        width: 138,
        height: 138,
        borderRadius: 69,
        backgroundColor: '#D9EAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    illustrationInner: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        gap: spacing.sm,
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    actions: {
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
    nextCard: {
        marginTop: spacing.lg,
        padding: spacing.lg,
        borderRadius: 24,
        backgroundColor: '#F6FAFF',
        gap: spacing.xs,
    },
});

