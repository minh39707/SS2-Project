import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import PrimaryButton from '@/src/components/ui/PrimaryButton';
import ScreenContainer from '@/src/components/ui/ScreenContainer';
import SecondaryButton from '@/src/components/ui/SecondaryButton';
import { ONBOARDING_COPY } from '@/src/constants/onboarding';

export default function WelcomeScreen() {
    const router = useRouter();
    return (
        <ScreenContainer contentContainerStyle={styles.content} scroll={false}>
            <Animated.View entering={FadeInDown.duration(450)} style={styles.hero}>
                <View style={styles.logoBadge}>
                    <Ionicons color={colors.primary} name="sparkles-outline" size={28} />
                </View>

                <View style={styles.illustration}>
                    <View style={styles.illustrationCard}>
                        <View style={styles.dotRow}>
                            <View style={[styles.dot, styles.dotPrimary]} />
                            <View style={[styles.dot, styles.dotSoft]} />
                            <View style={[styles.dot, styles.dotWarm]} />
                        </View>
                        <View style={styles.illustrationLine} />
                        <View style={[styles.illustrationLine, styles.illustrationLineShort]} />
                        <View style={styles.progressPill}>
                            <Ionicons color={colors.primary} name="checkmark" size={16} />
                            <Text variant="label" color="primary">
                                Gentle progress
                            </Text>
                        </View>
                    </View>
                </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(520).delay(50)} style={styles.copyWrap}>
                <Text variant="title" style={styles.title}>
                    {ONBOARDING_COPY.welcomeTitle}
                </Text>
                <Text variant="body" color="muted" style={styles.description}>
                    {ONBOARDING_COPY.welcomeDescription}
                </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(580).delay(100)} style={styles.actions}>
                <PrimaryButton label="Let's Begin" onPress={() => router.push('/life-area')} />
                    <SecondaryButton
                        label="Login if you have account"
                        onPress={() => router.push('/sign-in')}
                    />
                </Animated.View>
            </ScreenContainer>
        );
    }

const styles = StyleSheet.create({
    content: {
        justifyContent: 'space-between',
        gap: spacing.xl,
    },
    hero: {
        gap: spacing.xl,
        paddingTop: spacing.xl,
    },
    logoBadge: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    illustration: {
        alignItems: 'center',
    },
    illustrationCard: {
        width: '100%',
        minHeight: 250,
        borderRadius: radii.xxl,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        justifyContent: 'center',
        gap: spacing.md,
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
    },
    dotRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    dotPrimary: {
        backgroundColor: colors.primary,
    },
    dotSoft: {
        backgroundColor: '#A7F3D0',
    },
    dotWarm: {
        backgroundColor: '#FDE68A',
    },
    illustrationLine: {
        height: 16,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
    },
    illustrationLineShort: {
        width: '68%',
    },
    progressPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: '#EEF6FF',
    },
    copyWrap: {
        gap: spacing.sm,
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
    },
    actions: {
        gap: spacing.sm,
    },
});

