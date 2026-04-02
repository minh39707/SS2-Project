import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Card from "@/src/components/ui/Card";
import ProfileAvatar from "@/src/components/ui/ProfileAvatar";
import Button from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, spacing } from "@/src/constants/theme";
import {
  getCurrentUser,
  updateCurrentUserAvatar,
  uploadCurrentUserAvatar,
} from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";
import { AVATAR_PRESETS } from "@/src/utils/avatar";

export default function SettingsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const {
    completed,
    hydrated,
    resetOnboarding,
    updateUserProfile,
    userProfile,
  } = useOnboarding();
  const [profile, setProfile] = useState(null);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(
    userProfile?.avatarUrl ?? null,
  );
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const displayName = profile?.name ?? userProfile?.name ?? "Habit Hero";
  const activeAvatarUrl = selectedAvatarUrl ?? profile?.avatarUrl ?? null;
  const hasChanges = (selectedAvatarUrl ?? null) !== (profile?.avatarUrl ?? null);
  const providerAvatarUrl = userProfile?.providerAvatarUrl ?? null;

  useEffect(() => {
    setSelectedAvatarUrl(userProfile?.avatarUrl ?? null);
  }, [userProfile?.avatarUrl]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!completed || !userProfile?.id || !isFocused) {
      setLoadingProfile(false);
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setLoadingProfile(true);

      try {
        const result = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        setProfile(result);
        setSelectedAvatarUrl(result.avatarUrl ?? null);
        setError(null);
        updateUserProfile({
          name: result.name,
          avatarUrl: result.avatarUrl ?? null,
        });
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your profile right now.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [completed, hydrated, isFocused, updateUserProfile, userProfile?.id]);

  const providerLabel = useMemo(() => {
    if (userProfile?.authMethod === "google") {
      return "Google account";
    }

    if (userProfile?.authMethod === "facebook") {
      return "Facebook account";
    }

    if (userProfile?.authMethod === "github") {
      return "GitHub account";
    }

    if (userProfile?.authMethod === "email") {
      return "Email account";
    }

    return "Signed in";
  }, [userProfile?.authMethod]);

  const handleSaveAvatar = async () => {
    if (savingAvatar || uploadingAvatar) {
      return;
    }

    if (!hasChanges) {
      setSuccessMessage("Avatar is already synced.");
      return;
    }

    setSavingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProfile = await updateCurrentUserAvatar(selectedAvatarUrl);
      setProfile(updatedProfile);
      updateUserProfile({
        name: updatedProfile.name,
        avatarUrl: updatedProfile.avatarUrl ?? null,
      });
      setSuccessMessage("Avatar updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your avatar right now.",
      );
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleUseProviderPhoto = () => {
    if (!providerAvatarUrl) {
      return;
    }

    setSelectedAvatarUrl(providerAvatarUrl);
    setError(null);
    setSuccessMessage(null);
  };

  const handleUploadFromDevice = async () => {
    if (savingAvatar || uploadingAvatar) {
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to upload your avatar.",
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (pickerResult.canceled) {
      return;
    }

    const asset = pickerResult.assets?.[0];

    if (!asset?.base64) {
      setError("Unable to read that image. Please try another photo.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProfile = await uploadCurrentUserAvatar({
        contentType: asset.mimeType ?? "image/jpeg",
        imageBase64: asset.base64,
      });

      setProfile(updatedProfile);
      setSelectedAvatarUrl(updatedProfile.avatarUrl ?? null);
      updateUserProfile({
        name: updatedProfile.name,
        avatarUrl: updatedProfile.avatarUrl ?? null,
      });
      setSuccessMessage("Avatar uploaded.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload your avatar right now.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await resetOnboarding();
    router.replace("/welcome");
  };

  if (!hydrated || loadingProfile) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!completed || !userProfile?.id) {
    return (
      <View style={styles.screen}>
        <Card style={styles.card}>
          <Text variant="subtitle">Sign in required</Text>
          <Text color="muted" variant="body">
            Sign in to choose an avatar and personalize your account.
          </Text>
          <Button label="Go to welcome" onPress={() => router.replace("/welcome")} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <Animated.View entering={FadeInDown.duration(380)} style={styles.headerBlock}>
        <Text variant="title">Settings</Text>
        <Text color="muted" variant="body">
          Customize your profile and keep your account ready across devices.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(430).delay(40)}>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <ProfileAvatar
              avatarUrl={activeAvatarUrl}
              name={displayName}
              seed={userProfile?.id ?? displayName}
              size={84}
            />

            <View style={styles.profileCopy}>
              <Text variant="subtitle">{displayName}</Text>
              <Text color="muted" variant="body">
                {providerLabel}
              </Text>
              <Text color="muted" variant="caption">
                Use your login photo, upload your own image, or choose a preset avatar.
              </Text>
            </View>
          </View>

          {error ? (
            <Text style={styles.errorText} variant="caption">
              {error}
            </Text>
          ) : null}

          {successMessage ? (
            <Text style={styles.successText} variant="caption">
              {successMessage}
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(470).delay(80)}>
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Choose your avatar</Text>
          </View>

          <View style={styles.actionChips}>
            {providerAvatarUrl ? (
              <Pressable
                onPress={handleUseProviderPhoto}
                style={({ pressed }) => [
                  styles.resetChip,
                  pressed && styles.resetChipPressed,
                ]}
              >
                <Ionicons color={colors.primary} name="person-circle-outline" size={14} />
                <Text color="primary" variant="caption">
                  Use {providerLabel} photo
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => void handleUploadFromDevice()}
              style={({ pressed }) => [
                styles.resetChip,
                pressed && styles.resetChipPressed,
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons color={colors.primary} name="image-outline" size={14} />
              )}
              <Text color="primary" variant="caption">
                Upload from device
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSelectedAvatarUrl(null);
                setError(null);
                setSuccessMessage(null);
              }}
              style={({ pressed }) => [
                styles.resetChip,
                pressed && styles.resetChipPressed,
              ]}
            >
              <Ionicons color={colors.primary} name="refresh" size={14} />
              <Text color="primary" variant="caption">
                Use default
              </Text>
            </Pressable>
          </View>

          <View style={styles.avatarGrid}>
            {AVATAR_PRESETS.map((preset) => {
              const isSelected = preset.url === activeAvatarUrl;

              return (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    setSelectedAvatarUrl(preset.url);
                    setSuccessMessage(null);
                  }}
                  style={({ pressed }) => [
                    styles.avatarOption,
                    isSelected && styles.avatarOptionSelected,
                    pressed && styles.avatarOptionPressed,
                  ]}
                >
                  <ProfileAvatar
                    avatarUrl={preset.url}
                    name={preset.label}
                    seed={preset.id}
                    size={54}
                  />
                  <Text color={isSelected ? "primary" : "default"} variant="caption">
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            icon={
              savingAvatar || uploadingAvatar ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Ionicons color={colors.surface} name="save-outline" size={16} />
              )
            }
            label={savingAvatar ? "Saving..." : uploadingAvatar ? "Uploading..." : "Save avatar"}
            onPress={() => void handleSaveAvatar()}
            style={styles.saveButton}
            variant="primary"
          />

          {!hasChanges ? (
            <Text color="muted" variant="caption">
              Your selected avatar is already synced.
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(510).delay(120)}>
        <Card style={styles.card}>
          <Text variant="subtitle">Account</Text>
          <Text color="muted" variant="body">
            Sign out from this device when you want to switch accounts.
          </Text>
          <Button
            label="Log out"
            onPress={() => void handleLogout()}
            style={styles.logoutButton}
            textStyle={styles.logoutText}
            variant="outline"
          />
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerBlock: {
    gap: 6,
  },
  profileCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  actionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: "#EDF5FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetChipPressed: {
    opacity: 0.82,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  avatarOption: {
    width: "30%",
    minWidth: 94,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFD",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EDF5FF",
  },
  avatarOptionPressed: {
    opacity: 0.88,
  },
  saveButton: {
    minHeight: 50,
  },
  logoutButton: {
    minHeight: 48,
  },
  logoutText: {
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
  },
  successText: {
    color: colors.success,
  },
});
