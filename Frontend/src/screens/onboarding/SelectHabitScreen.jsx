import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { spacing } from '@/src/constants/theme';
import BackHeader from '@/src/components/BackHeader';
import HabitPreviewCard from '@/src/components/HabitPreviewCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenContainer from '@/src/components/ScreenContainer';
import SecondaryButton from '@/src/components/SecondaryButton';
import SelectCard from '@/src/components/SelectCard';
import { ONBOARDING_COPY, ONBOARDING_TOTAL_STEPS, PRESET_HABITS } from '@/src/constants/onboarding';
import { useOnboarding } from '@/src/store/OnboardingContext';
import { getHabitDisplayName } from '@/src/utils/onboarding';
export default function SelectHabitScreen() {
    const router = useRouter();
    const { data, setHabitSelection } = useOnboarding();
    const selectedHabitLabel = getHabitDisplayName(data.habit_name, data.habit_type);
    return (<ScreenContainer>
      <BackHeader onBack={() => router.back()} step={3} totalSteps={ONBOARDING_TOTAL_STEPS}/>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Text variant="title">{ONBOARDING_COPY.habitTitle}</Text>
        <Text variant="body" color="muted">
          {ONBOARDING_COPY.habitDescription}
        </Text>
      </Animated.View>

      {data.habit_name ? (<Animated.View entering={FadeInDown.duration(420).delay(20)} style={styles.preview}>
          <HabitPreviewCard habitLabel={selectedHabitLabel}/>
        </Animated.View>) : null}

      <View style={styles.list}>
        {PRESET_HABITS.map((habit, index) => (<Animated.View entering={FadeInDown.duration(440).delay(index * 50)} key={habit.value}>
            <SelectCard description={habit.description} icon={habit.icon} onPress={() => setHabitSelection(habit.value, 'preset')} selected={data.habit_type === 'preset' && data.habit_name === habit.value} title={habit.label}/>
          </Animated.View>))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton disabled={!data.habit_name} label="Continue with this habit" onPress={() => router.push('/schedule')}/>
        <SecondaryButton label="Create your own" onPress={() => router.push('/create-habit')}/>
      </View>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    header: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    preview: {
        marginBottom: spacing.md,
    },
    list: {
        gap: spacing.sm,
    },
    actions: {
        gap: spacing.xs,
        marginTop: spacing.xl,
    },
});

