import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import { DAY_OPTIONS } from '@/src/constants/onboarding';
export default function DaySelector({ selectedDays, onToggle }) {
    return (<View style={styles.wrap}>
      {DAY_OPTIONS.map((day) => {
            const selected = selectedDays.includes(day.value);
            return (<Pressable key={day.value} onPress={() => {
                    void Haptics.selectionAsync();
                    onToggle(day.value);
                }} style={({ pressed }) => [styles.dayChip, selected && styles.dayChipSelected, pressed && styles.dayChipPressed]}>
            <Text variant="label" style={[styles.dayText, selected && styles.dayTextSelected]}>
              {day.short}
            </Text>
          </Pressable>);
        })}
    </View>);
}
const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    dayChip: {
        minWidth: 52,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    dayChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayChipPressed: {
        transform: [{ scale: 0.98 }],
    },
    dayText: {
        color: colors.text,
    },
    dayTextSelected: {
        color: colors.surface,
    },
});

