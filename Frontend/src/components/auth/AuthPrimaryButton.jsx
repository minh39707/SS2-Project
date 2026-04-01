import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { radii, shadows } from '@/src/constants/theme';
import { authPalette } from './AuthScreenFrame';
export default function AuthPrimaryButton({ label, onPress, disabled, loading, icon }) {
    const handlePress = () => {
        if (disabled || loading) {
            return;
        }
        void Haptics.selectionAsync();
        onPress?.();
    };
    return (<Pressable accessibilityRole="button" disabled={disabled || loading} onPress={handlePress} style={({ pressed }) => [styles.pressable, pressed && !disabled && !loading && styles.pressablePressed]}>
      <LinearGradient colors={disabled ? ['#9CC0FF', '#8CB4F8'] : [authPalette.accentAlt, authPalette.accent]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.gradient}>
        {loading ? <ActivityIndicator color="#FFFFFF"/> : null}
        {!loading && icon ? <View style={styles.icon}>{icon}</View> : null}
        {!loading ? (<Text color="white" style={styles.label} variant="label">
            {label}
          </Text>) : null}
      </LinearGradient>
    </Pressable>);
}
const styles = StyleSheet.create({
    pressable: {
        borderRadius: radii.pill,
        ...shadows.soft,
    },
    pressablePressed: {
        transform: [{ scale: 0.985 }],
        opacity: 0.96,
    },
    gradient: {
        minHeight: 56,
        borderRadius: radii.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
    },
    icon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 15,
        lineHeight: 18,
        fontWeight: '700',
    },
});

