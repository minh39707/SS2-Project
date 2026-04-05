import { StyleSheet, View } from 'react-native';
import { colors } from '@/src/constants/colors';
import { radii, shadows } from '@/src/constants/theme';
export default function Card({ children, style }) {
    return <View style={[styles.card, style]}>{children}</View>;
}
const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        ...shadows.card,
    },
});

