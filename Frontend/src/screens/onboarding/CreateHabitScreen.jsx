import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import ScreenContainer from '@/src/components/ScreenContainer';

const HABIT_TYPES = [
  {
    type: 'good',
    title: 'Create Good Habit',
    description: 'Build a positive routine you want to repeat.',
    icon: 'leaf',
    iconColor: colors.primary,
    iconBg: '#EDF5FF',
  },
  {
    type: 'bad',
    title: 'Break Bad Habit',
    description: 'Track and reduce a habit you want to quit.',
    icon: 'ban',
    iconColor: '#64748B',
    iconBg: '#F1F5F9',
  },
];

export default function CreateHabitScreen() {
  const router = useRouter();

  const handleSelect = (type) => {
    router.push({ pathname: '/create-habit-form', params: { habitType: type } });
  };

  return (
    <ScreenContainer scroll={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <Ionicons color={colors.text} name="close" size={24} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.titleWrap}>
          <Text variant="title" style={styles.title}>
            What would you like to do?
          </Text>
          <Text variant="body" color="muted">
            Choose a direction for your new habit.
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          {HABIT_TYPES.map((item, index) => (
            <Animated.View
              entering={FadeInDown.duration(450).delay(index * 80)}
              key={item.type}
            >
              <Pressable
                onPress={() => handleSelect(item.type)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                  <Ionicons color={item.iconColor} name={item.icon} size={28} />
                </View>
                <View style={styles.cardText}>
                  <Text variant="subtitle">{item.title}</Text>
                  <Text variant="body" color="muted">
                    {item.description}
                  </Text>
                </View>
                <Ionicons color="#CBD5E1" name="chevron-forward" size={20} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  titleWrap: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    backgroundColor: '#F8FAFF',
    transform: [{ scale: 0.99 }],
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
});
