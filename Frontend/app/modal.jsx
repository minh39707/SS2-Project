import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
export default function ModalScreen() {
    return (<View style={styles.screen}>
      <Card style={styles.card}>
        <Text variant="title">Them nhanh</Text>
        <Text variant="body" color="muted">
          Day la diem vao de tao habit moi, them nhac nho hoac ghi nhanh muc tieu trong ngay.
        </Text>

        <View style={styles.option}>
          <Text variant="subtitle">Them thoi quen tot</Text>
          <Text variant="caption" color="muted">
            Vi du: doc sach 10 phut, di bo 15 phut, uong them 1 ly nuoc.
          </Text>
        </View>

        <View style={styles.option}>
          <Text variant="subtitle">Them thoi quen can giam</Text>
          <Text variant="caption" color="muted">
            Vi du: hut thuoc, luot MXH qua muc, thuc khuya.
          </Text>
        </View>

        <Link dismissTo href="/" style={styles.link}>
          <Text variant="label" color="primary">
            Quay ve Home
          </Text>
        </Link>
      </Card>
    </View>);
}
const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    card: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    option: {
        gap: 4,
        paddingVertical: spacing.xs,
    },
    link: {
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
    },
});

