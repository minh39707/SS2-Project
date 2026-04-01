import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
import PrimaryButton from '@/src/components/PrimaryButton';
export default function EmptyStateCard({ title, description, actionLabel, onAction }) {
    return (<Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.primary} name="alert-circle-outline" size={24}/>
      </View>
      <View style={styles.body}>
        <Text variant="subtitle" style={styles.title}>
          {title}
        </Text>
        <Text variant="body" color="muted" style={styles.description}>
          {description}
        </Text>
      </View>
      <PrimaryButton label={actionLabel} onPress={onAction}/>
    </Card>);
}
const styles = StyleSheet.create({
    card: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        gap: spacing.xs,
    },
    title: {
        fontSize: 20,
        lineHeight: 26,
    },
    description: {
        fontSize: 14,
        lineHeight: 21,
    },
});

