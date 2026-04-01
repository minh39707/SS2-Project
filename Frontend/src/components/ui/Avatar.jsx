import { StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii } from '@/src/constants/theme';
export default function Avatar({ name, level, progress }) {
    const safeProgress = Math.max(0, Math.min(progress ?? 0, 1));
    const initials = name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    return (<View style={styles.wrap}>
      <View style={styles.ring}>
        <View style={[styles.ringProgress, { transform: [{ rotate: `${safeProgress * 360}deg` }] }]}/>
        <View style={styles.avatar}>
          <Text variant="subtitle" color="primary">
            {initials}
          </Text>
        </View>
      </View>
      <View style={styles.badge}>
        <Text variant="caption" color="white">
          Lv {level}
        </Text>
      </View>
    </View>);
}
const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        gap: 6,
    },
    ring: {
        width: 76,
        height: 76,
        borderRadius: radii.pill,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ringProgress: {
        position: 'absolute',
        width: 76,
        height: 76,
        borderRadius: radii.pill,
        borderWidth: 6,
        borderColor: colors.primary,
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
    },
    avatar: {
        width: 58,
        height: 58,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
    },
});

