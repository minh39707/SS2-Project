import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { spacing } from '@/src/constants/theme';
export default function SecondaryButton({ label, onPress, style }) {
    const handlePress = () => {
        void Haptics.selectionAsync();
        onPress?.();
    };
    return (<Pressable accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}>
      <Text variant="label" color="primary">
        {label}
      </Text>
    </Pressable>);
}
const styles = StyleSheet.create({
    button: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
    },
    pressed: {
        opacity: 0.72,
    },
});

