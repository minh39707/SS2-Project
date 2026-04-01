import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingButton from '@/src/components/layout/FloatingButton';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
const iconMap = {
    index: { active: 'home', idle: 'home-outline' },
    analytics: { active: 'stats-chart', idle: 'stats-chart-outline' },
    store: { active: 'bag-handle', idle: 'bag-handle-outline' },
    settings: { active: 'settings', idle: 'settings-outline' },
};
export default function BottomTab({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();
    const renderItem = (route, index) => {
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;
        const focused = state.index === index;
        const onPress = () => {
            void Haptics.selectionAsync();
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
            }
        };
        return (<Pressable key={route.key} onPress={onPress} style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                pressed && styles.itemPressed,
            ]}>
        <Ionicons name={focused ? iconMap[route.name].active : iconMap[route.name].idle} size={20} color={focused ? colors.primary : colors.textMuted}/>
        <Text variant="caption" style={[styles.label, focused && styles.labelActive]}>
          {label}
        </Text>
      </Pressable>);
    };
    return (<View style={[styles.shell, { bottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        <View style={styles.group}>{state.routes.slice(0, 2).map((route, index) => renderItem(route, index))}</View>
        <View style={styles.centerSlot}/>
        <View style={styles.group}>{state.routes.slice(2).map((route, index) => renderItem(route, index + 2))}</View>
      </View>

      <View style={styles.fabWrap}>
        <FloatingButton />
      </View>
    </View>);
}
const styles = StyleSheet.create({
    shell: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md,
        alignItems: 'center',
    },
    bar: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: 30,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        ...shadows.card,
    },
    group: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
    },
    centerSlot: {
        width: 72,
    },
    item: {
        flex: 1,
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: radii.lg,
    },
    itemActive: {
        backgroundColor: '#EEF5FF',
    },
    itemPressed: {
        opacity: 0.8,
    },
    label: {
        color: colors.textMuted,
        fontSize: 11,
    },
    labelActive: {
        color: colors.primary,
        fontWeight: '700',
    },
    fabWrap: {
        position: 'absolute',
        top: -20,
    },
});

