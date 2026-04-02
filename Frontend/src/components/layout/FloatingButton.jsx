import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "@/src/constants/colors";
import { shadows } from "@/src/constants/theme";
import { useOnboarding } from "@/src/store/OnboardingContext";

export default function FloatingButton({ onPress }) {
  const { completed } = useOnboarding();

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (onPress) {
      onPress();
      return;
    }

    router.push(completed ? "/habit-create" : "/welcome");
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons color={colors.surface} name="add" size={28} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#EAF1FF",
    ...shadows.card,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
