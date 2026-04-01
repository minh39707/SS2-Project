import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
export default function HabitPreviewCard({ habitLabel, timeLabel, frequencyLabel }) {
    return (<Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={20}/>
        </View>
        <View style={styles.textWrap}>
          <Text variant="caption" color="muted">
            Your first habit
          </Text>
          <Text variant="subtitle">{habitLabel}</Text>
        </View>
      </View>

      {timeLabel || frequencyLabel ? (<View style={styles.metaWrap}>
          {timeLabel ? (<View style={styles.metaRow}>
              <Ionicons color={colors.textMuted} name="time-outline" size={16}/>
              <Text variant="body" color="muted">
                {timeLabel}
              </Text>
            </View>) : null}

          {frequencyLabel ? (<View style={styles.metaRow}>
              <Ionicons color={colors.textMuted} name="calendar-outline" size={16}/>
              <Text variant="body" color="muted">
                {frequencyLabel}
              </Text>
            </View>) : null}
        </View>) : null}
    </Card>);
}
const styles = StyleSheet.create({
    card: {
        padding: spacing.md,
        gap: spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textWrap: {
        flex: 1,
        gap: 4,
    },
    metaWrap: {
        gap: spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
});

