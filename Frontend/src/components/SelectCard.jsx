import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
export default function SelectCard({ title, description, icon, selected, onPress }) {
    const handlePress = () => {
        void Haptics.selectionAsync();
        onPress?.();
    };
    return (<Pressable accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons color={selected ? colors.primary : colors.textMuted} name={(icon ?? 'sparkles-outline')} size={20}/>
        </View>
        {selected ? (<View style={styles.checkWrap}>
            <Ionicons color={colors.primary} name="checkmark-circle" size={22}/>
          </View>) : null}
      </View>
      <View style={styles.body}>
        <Text variant="subtitle" style={styles.title}>
          {title}
        </Text>
        {description ? (<Text variant="body" color="muted" style={styles.description}>
            {description}
          </Text>) : null}
      </View>
    </Pressable>);
}
const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
        ...shadows.soft,
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: '#F7FBFF',
    },
    cardPressed: {
        transform: [{ scale: 0.99 }],
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapSelected: {
        backgroundColor: colors.primarySoft,
    },
    checkWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        gap: 6,
    },
    title: {
        fontSize: 17,
        lineHeight: 22,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
});

