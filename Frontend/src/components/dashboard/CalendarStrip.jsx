import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
export default function CalendarStrip({ monthLabel, days }) {
    return (<Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="subtitle">{monthLabel}</Text>
        <View style={styles.todayPill}>
          <Text variant="caption" color="primary">
            Hom nay
          </Text>
        </View>
      </View>

      <View style={styles.daysRow}>
        {days.map((day) => {
            const isSelected = day.isSelected;
            const isEmpty = day.status === 'empty';
            const statusColor = day.status === 'done' ? colors.success : day.status === 'warning' ? colors.warning : '#CBD5E1';
            return (<View key={`${day.label}-${day.date}`} style={[
                    styles.dayCard,
                    day.status === 'done' && styles.dayCardDone,
                    day.status === 'warning' && styles.dayCardWarning,
                    isSelected && styles.dayCardSelected,
                ]}>
              <Text variant="caption" color={isSelected ? 'white' : 'muted'}>
                {day.label}
              </Text>
              <Text variant={isSelected ? 'subtitle' : 'label'} color={isSelected ? 'white' : 'default'}>
                {day.date}
              </Text>
              <View style={[
                    styles.statusDot,
                    day.status === 'done' && styles.statusDotDone,
                    day.status === 'warning' && styles.statusDotWarning,
                    isEmpty && styles.statusDotEmpty,
                    isSelected && styles.statusDotSelected,
                ]}>
                {isEmpty ? (<View style={styles.futureDot}/>) : day.status === 'done' ? (<Ionicons color={statusColor} name="checkmark" size={16}/>) : (<Text variant="label" style={[styles.warningMark, { color: statusColor }]}>
                    !
                  </Text>)}
              </View>
            </View>);
        })}
      </View>
    </Card>);
}
const styles = StyleSheet.create({
    card: {
        padding: spacing.md,
        gap: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    todayPill: {
        backgroundColor: colors.primarySoft,
        borderRadius: radii.pill,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    daysRow: {
        flexDirection: 'row',
        gap: 8,
    },
    dayCard: {
        flex: 1,
        minWidth: 0,
        borderRadius: radii.lg,
        backgroundColor: '#F8FAFD',
        paddingVertical: 10,
        paddingHorizontal: 4,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#E6EDF6',
    },
    dayCardDone: {
        borderColor: '#BDE8CC',
    },
    dayCardWarning: {
        borderColor: '#F8D58A',
    },
    dayCardSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        paddingVertical: 14,
        transform: [{ translateY: -5 }],
    },
    statusDot: {
        width: 28,
        height: 28,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    statusDotDone: {
        backgroundColor: '#ECFDF3',
        borderColor: '#A7E0BB',
    },
    statusDotWarning: {
        backgroundColor: '#FFF6E7',
        borderColor: '#F5D084',
    },
    statusDotEmpty: {
        backgroundColor: '#F8FAFD',
        borderColor: '#E2E8F0',
    },
    statusDotSelected: {
        backgroundColor: colors.surface,
        borderColor: '#D7E6FF',
    },
    futureDot: {
        width: 8,
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: '#CBD5E1',
    },
    warningMark: {
        fontSize: 15,
        lineHeight: 16,
        fontWeight: '700',
    },
});

