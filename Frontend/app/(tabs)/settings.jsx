import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Card from '@/src/components/ui/Card';
import { Text } from '@/src/components/ui/Text';
import Button from '@/src/components/ui/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/theme';
import { useOnboarding } from '@/src/store/OnboardingContext';

export default function SettingsScreen() {
    const router = useRouter();
    const { resetOnboarding } = useOnboarding();

    const handleLogout = async () => {
        await resetOnboarding();
        router.replace('/welcome');
    };

    return (<View style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.content}>
        <Text variant="title">Cài đặt</Text>
        
        <Card style={styles.card}>
          <Text variant="subtitle">Cá nhân hóa</Text>
          <Text variant="body" color="muted">
            Tại đây bạn có thể thêm thông báo, mục tiêu ngày và chế độ đồng bộ tài khoản.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="subtitle">Tài khoản</Text>
          <Button 
            title="Đăng xuất" 
            variant="outline" 
            onPress={() => void handleLogout()} 
            style={styles.logoutBtn}
            textStyle={styles.logoutText}
          />
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

