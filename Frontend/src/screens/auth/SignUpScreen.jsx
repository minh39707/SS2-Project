import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "@/src/components/ui/Text";
import { spacing } from "@/src/constants/theme";
import AuthField from "@/src/components/auth/AuthField";
import AuthPrimaryButton from "@/src/components/auth/AuthPrimaryButton";
import AuthScreenFrame, {
  authPalette,
} from "@/src/components/auth/AuthScreenFrame";
import AuthSocialSection from "@/src/components/auth/AuthSocialSection";
import { useOnboarding } from "@/src/store/OnboardingContext";
export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { authenticate, isSaving, saveError } = useOnboarding();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inlineError, setInlineError] = useState(null);
  const source = params.source ?? "onboarding";

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setInlineError("Please fill in your name, email, and password.");
      return;
    }
    setInlineError(null);
    try {
      await authenticate({
        method: "email",
        mode: "signUp",
        payload: {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        },
      });
      router.replace("/(tabs)");
    } catch {
      return;
    }
  };
  const handleSocialAuth = async (provider) => {
    setInlineError(null);
    try {
      await authenticate({ method: provider });
      router.replace("/(tabs)");
    } catch {
      return;
    }
  };
  return (
    <AuthScreenFrame
      subtitle="Create your account to unlock your HabitForge dashboard."
      title="Create an Account"
    >
      <Animated.View
        entering={FadeInDown.duration(470).delay(30)}
        style={styles.form}
      >
        <AuthField
          autoComplete="name"
          icon="person-outline"
          label="Name"
          onChangeText={setFullName}
          placeholder="Alex Morgan"
          value={fullName}
        />
        <AuthField
          autoCapitalize="none"
          autoComplete="email"
          icon="mail-outline"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="alex@habitforge.app"
          value={email}
        />
        <AuthField
          autoComplete="password-new"
          icon="lock-closed-outline"
          label="Password"
          onChangeText={setPassword}
          placeholder="Create a secure password"
          secureTextEntry
          value={password}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(510).delay(60)}
        style={styles.actionBlock}
      >
        {inlineError || saveError ? (
          <Text variant="body" style={styles.errorText}>
            {inlineError ?? saveError}
          </Text>
        ) : null}

        <AuthPrimaryButton
          label="Create Account"
          loading={isSaving}
          onPress={() => void handleSubmit()}
        />
        <AuthSocialSection
          onPress={(provider) => void handleSocialAuth(provider)}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(560).delay(90)}
        style={styles.footer}
      >
        <Text style={styles.footerText} variant="body">
          Already have an account?
        </Text>
        <Pressable onPress={() => router.replace(`/sign-in?source=${source}`)}>
          <Text style={styles.footerLink} variant="body">
            Login
          </Text>
        </Pressable>
      </Animated.View>
    </AuthScreenFrame>
  );
}
const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  errorText: {
    color: "#D64545",
    textAlign: "center",
  },
  actionBlock: {
    gap: spacing.md,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    color: authPalette.muted,
  },
  footerLink: {
    color: authPalette.accent,
    fontWeight: "700",
  },
});
