import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { fonts, radii, shadows, spacing } from '@/src/constants/theme';
import ScreenContainer from '@/src/components/ScreenContainer';
import { useRouter } from 'expo-router';
export const authPalette = {
    accent: '#1E6DEB',
    accentAlt: '#4B8AF5',
    accentSoft: '#EAF3FF',
    accentSurface: '#F5F9FF',
    backgroundStart: '#EEF6FF',
    backgroundEnd: '#DDEBFF',
    border: '#D6E6FF',
    card: '#FCFDFF',
    input: '#EAF3FF',
    inputText: '#10213F',
    muted: '#6D7A90',
};
export default function AuthScreenFrame({ title, subtitle, children }) {
    const router = useRouter();
    const canGoBack = router.canGoBack();
    return (<ScreenContainer contentContainerStyle={styles.content} style={styles.screen}>
      <LinearGradient colors={[authPalette.backgroundStart, authPalette.backgroundEnd]} style={styles.gradient}/>
      <View pointerEvents="none" style={styles.glowTop}/>
      <View pointerEvents="none" style={styles.glowBottom}/>

      {canGoBack && (<Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
          <Ionicons color={authPalette.muted} name="arrow-back" size={24}/>
        </Pressable>)}

      <Animated.View entering={FadeInDown.duration(420)} style={styles.card}>
        <View style={styles.brandPill}>
          <View style={styles.brandIcon}>
            <Ionicons color={authPalette.accent} name="sparkles-outline" size={16}/>
          </View>
          <Text style={styles.brandText}>HabitForge</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (<Text style={styles.subtitle} variant="body">
              {subtitle}
            </Text>) : null}
        </View>

        {children}
      </Animated.View>
    </ScreenContainer>);
}
const styles = StyleSheet.create({
    screen: {
        backgroundColor: authPalette.backgroundEnd,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingTop: spacing.xxl,
        paddingBottom: spacing.xxl + spacing.lg,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    glowTop: {
        position: 'absolute',
        top: -120,
        right: -70,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255,255,255,0.42)',
    },
    glowBottom: {
        position: 'absolute',
        bottom: -90,
        left: -40,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    card: {
        borderRadius: 28,
        backgroundColor: authPalette.card,
        paddingHorizontal: 24,
        paddingVertical: 26,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.75)',
        gap: 22,
        ...shadows.card,
    },
    brandPill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: authPalette.accentSurface,
    },
    brandIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandText: {
        fontSize: 13,
        lineHeight: 16,
        color: authPalette.accent,
        fontFamily: fonts?.rounded,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    header: {
        gap: spacing.xs,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        fontSize: 30,
        lineHeight: 36,
        color: authPalette.inputText,
        fontFamily: fonts?.display,
        fontWeight: '700',
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        color: authPalette.muted,
        maxWidth: 250,
    },
    backButton: {
        position: 'absolute',
        top: spacing.xl + 8,
        left: spacing.lg,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        ...shadows.sm,
    },
    backButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.96 }],
    },
});

