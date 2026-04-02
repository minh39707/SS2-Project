import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { shadows } from "@/src/constants/theme";
import { getInitials, resolveAvatarUrl } from "@/src/utils/avatar";

export default function ProfileAvatar({
  name,
  avatarUrl,
  seed,
  size = 60,
  style,
  textStyle,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = resolveAvatarUrl(avatarUrl, seed ?? name);
  const initials = getInitials(name);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedAvatarUrl]);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      {!imageFailed ? (
        <Image
          contentFit="cover"
          onError={() => setImageFailed(true)}
          source={{ uri: resolvedAvatarUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          transition={120}
        />
      ) : null}

      {imageFailed ? (
        <Text style={[styles.initials, { fontSize: size * 0.34 }, textStyle]} variant="subtitle">
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#D9E8FF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...shadows.soft,
  },
  image: {
    backgroundColor: colors.primarySoft,
  },
  initials: {
    color: colors.primary,
    fontWeight: "700",
  },
});
