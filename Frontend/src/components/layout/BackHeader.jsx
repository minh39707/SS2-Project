import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import ProgressBar from '@/src/components/ui/ProgressBar';
export default function BackHeader({ step, totalSteps, onBack }) {
    const handlePress = () => {
        void Haptics.selectionAsync();
        onBack();
    };
    return (<View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={handlePress} style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
          <Ionicons color={colors.text} name="chevron-back" size={20}/>
        </Pressable>
        <Text variant="caption" color="muted">
          Step {step} of {totalSteps}
        </Text>
      </View>
      <ProgressBar progress={step / totalSteps}/>
    </View>);
}
const styles = StyleSheet.create({
    container: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backPressed: {
        opacity: 0.75,
    },
});

