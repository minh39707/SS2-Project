import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
export default function PrimaryButton({ label, onPress, disabled, loading, icon, style }) {
    const handlePress = () => {
        if (disabled || loading) {
            return;
        }
        void Haptics.selectionAsync();
        onPress?.();
    };
    return (<Pressable accessibilityRole="button" disabled={disabled || loading} onPress={handlePress} style={({ pressed }) => [
            styles.button,
            disabled && styles.buttonDisabled,
            pressed && !disabled && !loading && styles.buttonPressed,
            style,
        ]}>
      {loading ? <ActivityIndicator color={colors.surface}/> : null}
      {!loading && icon ? <View style={styles.icon}>{icon}</View> : null}
      {!loading ? (<Text variant="label" color="white" style={styles.label}>
          {label}
        </Text>) : null}
    </Pressable>);
}
const styles = StyleSheet.create({
    button: {
        minHeight: 56,
        borderRadius: radii.pill,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        ...shadows.soft,
    },
    buttonDisabled: {
        backgroundColor: '#BFD4F6',
    },
    buttonPressed: {
        transform: [{ scale: 0.985 }],
        opacity: 0.95,
    },
    icon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 15,
    },
});

