import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
import BackHeader from '@/src/components/BackHeader';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenContainer from '@/src/components/ScreenContainer';
import { EDUCATION_ITEMS, ONBOARDING_COPY, ONBOARDING_TOTAL_STEPS } from '@/src/constants/onboarding';
export default function EducationScreen() {
    const router = useRouter();
    return (<ScreenContainer>
      <BackHeader onBack={() => router.back()} step={2} totalSteps={ONBOARDING_TOTAL_STEPS}/>

      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Text variant="title">{ONBOARDING_COPY.educationTitle}</Text>
        <Text variant="body" color="muted">
          {ONBOARDING_COPY.educationDescription}
        </Text>
      </Animated.View>

      <View style={styles.list}>
        {EDUCATION_ITEMS.map((item, index) => (<Animated.View entering={FadeInDown.duration(430).delay(index * 60)} key={item.title}>
            <Card style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons color={colors.primary} name={item.icon} size={22}/>
              </View>
              <View style={styles.cardText}>
                <Text variant="subtitle">{item.title}</Text>
                <Text variant="body" color="muted">
                  {item.description}
                </Text>
              </View>
            </Card>
          </Animated.View>))}
      </View>

      <PrimaryButton label="I'm Ready" onPress={() => router.push('/select-habit')} style={styles.cta}/>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    header: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    list: {
        gap: spacing.sm,
    },
    card: {
        padding: spacing.md,
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'flex-start',
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
        gap: spacing.xs,
    },
    cta: {
        marginTop: spacing.xl,
    },
});

