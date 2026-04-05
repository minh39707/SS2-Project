import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
export default function AnalyticsScreen() {
    return (<View style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.content}>
        <Text variant="title">Phan tich</Text>
        <Card style={styles.card}>
          <Text variant="subtitle">Tien do tuan nay</Text>
          <Text variant="body" color="muted">
            Khu vuc nay san sang de gan bieu do streak, ty le hoan thanh va thong ke theo ngay.
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

