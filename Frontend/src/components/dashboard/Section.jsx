import { StyleSheet, View } from 'react-native';
import Button from '@/src/components/ui/Button';
import { Text } from '@/src/components/ui/Text';
import { spacing } from '@/src/constants/theme';
export default function Section({ title, actionLabel, children }) {
    return (<View style={styles.section}>
      <View style={styles.header}>
        <Text variant="caption" color="muted" style={styles.title}>
          {title}
        </Text>
        {actionLabel ? <Button label={actionLabel} variant="ghost"/> : null}
      </View>
      {children}
    </View>);
}
const styles = StyleSheet.create({
    section: {
        gap: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
});

