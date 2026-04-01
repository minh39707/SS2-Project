import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { radii, shadows, spacing } from '@/src/constants/theme';
const iconMap = {
    run: 'walk',
    water: 'water',
    meditate: 'leaf',
    read: 'book',
};
export default function QuickActions({ actions }) {
    return (<View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="caption" color="muted" style={styles.kicker}>
          Nhiem vu phu
        </Text>
        <Text variant="caption" color="primary">
          4 muc
        </Text>
      </View>

      <View style={styles.grid}>
        {actions.map((action) => (<Pressable key={action.id} onPress={() => {
                void Haptics.selectionAsync();
            }} style={({ pressed }) => [
                styles.action,
                { backgroundColor: action.tintColor },
                pressed && styles.actionPressed,
            ]}>
            <View style={styles.actionTop}>
              <Text variant="label" style={styles.title}>
                {action.title}
              </Text>
              <View style={[styles.iconWrap, { backgroundColor: `${action.color}18` }]}>
                <Ionicons color={action.color} name={iconMap[action.icon]} size={18}/>
              </View>
            </View>
            <Text variant="body" color="muted" style={styles.description}>
              {action.description}
            </Text>
          </Pressable>))}
      </View>
    </View>);
}
const styles = StyleSheet.create({
    wrap: {
        gap: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    kicker: {
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
        columnGap: 8,
    },
    action: {
        width: '48%',
        maxWidth: '48%',
        minHeight: 82,
        borderRadius: radii.lg,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#EEF2F7',
        ...shadows.soft,
    },
    actionTop: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    actionPressed: {
        transform: [{ scale: 0.98 }],
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        textAlign: 'left',
        fontSize: 14,
        lineHeight: 18,
        flex: 1,
        color: '#111827',
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '700',
        color: '#4B5563',
    },
});

