import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/src/constants/colors';
import { radii, shadows } from '@/src/constants/theme';
export default function FloatingButton({ onPress }) {
    const handlePress = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) {
            onPress();
            return;
        }
        router.push('/modal');
    };
    return (<Pressable onPress={handlePress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="add" size={28} color={colors.surface}/>
    </Pressable>);
}
const styles = StyleSheet.create({
    button: {
        width: 62,
        height: 62,
        borderRadius: radii.pill,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 5,
        borderColor: '#EAF1FF',
        ...shadows.card,
    },
    pressed: {
        transform: [{ scale: 0.96 }],
    },
});

