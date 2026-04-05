import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
export default function HabitCard({ habit }) {
    const actionStyles = actionPalette[habit.actionTone];
    return (<Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: habit.iconBackground }]}>
        <Ionicons name={habit.icon} size={20} color={habit.iconColor}/>
      </View>

      <View style={styles.content}>
        <Text variant="subtitle">{habit.title}</Text>
        <Text variant="body" color="muted">
          {habit.progressLabel}
        </Text>
      </View>

      <View style={[styles.actionPill, { backgroundColor: actionStyles.backgroundColor }]}>
        <Ionicons name={actionStyles.icon} size={15} color={actionStyles.color}/>
        <Text variant="label" style={{ color: actionStyles.color }}>
          {habit.actionLabel}
        </Text>
      </View>
    </Card>);
}
const actionPalette = {
    warning: {
        backgroundColor: '#FFF5E8',
        color: colors.warning,
        icon: 'timer-outline',
    },
    primary: {
        backgroundColor: '#EEF5FF',
        color: colors.primary,
        icon: 'checkmark',
    },
    success: {
        backgroundColor: '#EAFBF1',
        color: colors.success,
        icon: 'checkmark',
    },
    neutral: {
        backgroundColor: '#F8FAFD',
        color: '#64748B',
        icon: 'checkmark',
    },
};
const styles = StyleSheet.create({
    card: {
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radii.xl,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        gap: 2,
    },
    actionPill: {
        minWidth: 94,
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: radii.pill,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
});

