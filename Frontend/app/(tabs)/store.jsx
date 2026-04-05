import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
export default function StoreScreen() {
    return (<View style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.content}>
        <Text variant="title">Cua hang</Text>
        <Card style={styles.card}>
          <Text variant="subtitle">Vat pham thuong</Text>
          <Text variant="body" color="muted">
            Ban co the them skin, booster va vat pham doi diem trong man hinh nay.
          </Text>
        </Card>
      </Animated.View>
    </View>);
}
const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
    },
    content: {
        gap: spacing.lg,
    },
    card: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
});

