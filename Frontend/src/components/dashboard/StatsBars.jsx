import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
export default function StatsBars({ stats, compact = false }) {
    return (<View style={styles.container}>
      {stats.map((stat) => (<View key={stat.label} style={[styles.row, compact && styles.rowCompact]}>
          <View style={styles.topRow}>
            <View style={styles.labelRow}>
              <View style={[styles.iconWrap, { backgroundColor: `${stat.color}14` }]}>
                <Ionicons name={stat.icon} size={14} color={stat.color}/>
              </View>
              <Text variant="caption" style={styles.metricText}>
                {stat.label}
              </Text>
            </View>
            <Text variant="caption" style={styles.valueText}>
              {stat.label === 'Streaks' ? stat.value : `${stat.value}/${stat.max}`}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { backgroundColor: stat.color, width: `${(stat.value / stat.max) * 100}%` }]}/>
          </View>
        </View>))}
    </View>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 10,
    },
    row: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: '#EDF2F8',
    },
    rowCompact: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricText: {
        color: colors.text,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    valueText: {
        color: colors.text,
        fontWeight: '700',
    },
    track: {
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: '#EEF3FA',
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: radii.pill,
    },
});

