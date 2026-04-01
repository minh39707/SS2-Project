import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
export default function Button({ label, title, onPress, icon, variant = 'primary', style, textStyle }) {
    const palette = palettes[variant] || palettes.primary;
    const handlePress = () => {
        void Haptics.selectionAsync();
        onPress?.();
    };
    return (<Pressable onPress={handlePress} style={({ pressed }) => [styles.button, palette.container, pressed && styles.pressed, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="label" style={[palette.label, textStyle]}>
        {label || title}
      </Text>
    </Pressable>);
}
const palettes = {
    primary: {
        container: { backgroundColor: colors.primary },
        label: { color: colors.surface },
    },
    secondary: {
        container: { backgroundColor: colors.primarySoft },
        label: { color: colors.primary },
    },
    ghost: {
        container: { backgroundColor: 'transparent' },
        label: { color: colors.text },
    },
    accent: {
        container: { backgroundColor: '#FFF2E2' },
        label: { color: colors.warning },
    },
    outline: {
        container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
        label: { color: colors.error },
    }
};
const styles = StyleSheet.create({
    button: {
        minHeight: 44,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        ...shadows.soft,
    },
    icon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.92,
    },
});

