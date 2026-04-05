import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
import BackHeader from '@/src/components/BackHeader';
import ScreenContainer from '@/src/components/ScreenContainer';
import SelectCard from '@/src/components/SelectCard';
import { LIFE_AREA_OPTIONS, ONBOARDING_COPY, ONBOARDING_TOTAL_STEPS } from '@/src/constants/onboarding';
import { useOnboarding } from '@/src/store/OnboardingContext';
export default function LifeAreaScreen() {
    const router = useRouter();
    const { data, hydrated, setLifeArea } = useOnboarding();
    if (!hydrated) {
        return (<View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>);
    }
    return (<ScreenContainer>
      <BackHeader onBack={() => router.back()} step={1} totalSteps={ONBOARDING_TOTAL_STEPS}/>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Text variant="title">{ONBOARDING_COPY.lifeAreaTitle}</Text>
        <Text variant="body" color="muted">
          Pick the area you want to support first. You can always change this later.
        </Text>
      </Animated.View>

      <View style={styles.list}>
        {LIFE_AREA_OPTIONS.map((option, index) => (<Animated.View entering={FadeInDown.duration(420).delay(index * 45)} key={option.value}>
            <SelectCard description={option.description} icon={option.icon} onPress={() => {
                setLifeArea(option);
                setTimeout(() => router.push('/education'), 110);
            }} selected={data.life_area === option.value} title={option.label}/>
          </Animated.View>))}
      </View>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    loader: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    list: {
        gap: spacing.sm,
    },
});

