import { StyleSheet, View } from 'react-native';
import StatsBars from '@/src/components/dashboard/StatsBars';
import Avatar from '@/src/components/ui/Avatar';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
export default function Header({ user, stats }) {
    const safeUser = {
        name: user.name || 'ÄĂ o Háº£i Nam',
        level: user.level ?? 0,
        levelProgress: user.levelProgress ?? 0,
    };
    const defaultStats = [
        { label: 'HP', value: 100, max: 100, color: colors.danger, icon: 'heart' },
        { label: 'EXP', value: 0, max: 100, color: colors.primary, icon: 'flash' },
        { label: 'Streaks', value: 0, max: 7, color: colors.warning, icon: 'flame' },
    ];
    const resolvedStats = defaultStats.map((fallbackStat) => {
        const matched = stats.find((stat) => stat.label === fallbackStat.label);
        return matched
            ? {
                ...matched,
                value: matched.value ?? 0,
                max: matched.max ?? fallbackStat.max,
            }
            : fallbackStat;
    });
    return (<View style={styles.container}>
      <View style={styles.topRow}>
        <Avatar name={safeUser.name} level={safeUser.level} progress={safeUser.levelProgress}/>
        <View style={styles.content}>
          <Text variant="title" style={styles.name}>
            {safeUser.name}
          </Text>
          <StatsBars stats={resolvedStats} compact/>
        </View>
      </View>
    </View>);
}
const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: radii.xxl,
        padding: spacing.md,
        gap: spacing.md,
        ...shadows.card,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    content: {
        flex: 1,
        gap: spacing.xs,
        justifyContent: 'center',
    },
    name: {
        fontSize: 22,
        lineHeight: 28,
        marginTop: 2,
    },
});

