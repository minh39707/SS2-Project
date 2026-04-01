import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/components/ui/Text";
import { shadows, spacing } from "@/src/constants/theme";
import { authPalette } from "./AuthScreenFrame";

const providers = [
  {
    provider: "facebook",
    icon: "logo-facebook",
    backgroundColor: "#EEF4FF",
    iconColor: "#1877F2",
  },
  {
    provider: "google",
    icon: "logo-google",
    backgroundColor: "#FFFFFF",
    iconColor: "#EA4335",
  },
  {
    provider: "github",
    icon: "logo-github",
    backgroundColor: "#F5F7FB",
    iconColor: "#111827",
  },
];

export default function AuthSocialSection({
  label = "Or Sign in with",
  onPress,
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label} variant="caption">
        {label}
      </Text>

      <View style={styles.row}>
        {providers.map((item) => (
          <Pressable
            accessibilityLabel={`${item.provider} auth`}
            accessibilityRole="button"
            key={item.provider}
            onPress={() => {
              void Haptics.selectionAsync();
              onPress?.(item.provider);
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: item.backgroundColor },
              ]}
            >
              <Ionicons color={item.iconColor} name={item.icon} size={22} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    alignItems: "center",
  },
  label: {
    color: authPalette.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  button: {
    borderRadius: 18,
    ...shadows.soft,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(214, 230, 255, 0.9)",
  },
});
