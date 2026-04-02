import { StyleSheet, View } from "react-native";
import ProfileAvatar from "@/src/components/ui/ProfileAvatar";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii } from "@/src/constants/theme";

export default function Avatar({ name, level, progress, avatarUrl, seed }) {
  const safeProgress = Math.max(0, Math.min(progress ?? 0, 1));

  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <View
          style={[
            styles.ringProgress,
            { transform: [{ rotate: `${safeProgress * 360}deg` }] },
          ]}
        />
        <ProfileAvatar
          avatarUrl={avatarUrl}
          name={name}
          seed={seed ?? name}
          size={58}
          style={styles.avatar}
          textStyle={styles.initials}
        />
      </View>
      <View style={styles.badge}>
        <Text color="white" variant="caption">
          Lv {level}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 6,
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ringProgress: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    borderWidth: 6,
    borderColor: colors.primary,
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  initials: {
    color: colors.primary,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
});
