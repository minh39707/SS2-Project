import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/src/constants/colors";
import { Text } from "@/src/components/ui/Text";
import { useOnboarding } from "@/src/store/OnboardingContext";

function normalizeParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function buildRedirectUrlFromParams(params, baseUrl) {
  const entries = Object.entries(params ?? {});

  if (!entries.length) {
    return null;
  }

  const query = new URLSearchParams();
  let hash = normalizeParamValue(params?.["#"]);

  for (const [key, rawValue] of entries) {
    if (key === "#") {
      continue;
    }

    const value = normalizeParamValue(rawValue);

    if (value != null) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  const hashString = hash ? `#${hash}` : "";

  if (!queryString && !hashString) {
    return null;
  }

  return `${baseUrl}${queryString ? `?${queryString}` : ""}${hashString}`;
}

function hasOAuthPayload(value) {
  if (!value) {
    return false;
  }

  return [
    "code=",
    "access_token=",
    "refresh_token=",
    "error_description=",
  ].some((token) => value.includes(token));
}

function hasOAuthParams(params) {
  if (!params) {
    return false;
  }

  return [
    "code",
    "access_token",
    "refresh_token",
    "error_description",
    "#",
  ].some((key) => {
    const value = params[key];
    return Array.isArray(value)
      ? value.length > 0
      : typeof value === "string" && value.length > 0;
  });
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useURL();
  const params = useLocalSearchParams();
  const fallbackBaseUrl = useMemo(() => Linking.createURL("auth-callback"), []);
  const derivedUrl = useMemo(
    () => buildRedirectUrlFromParams(params, fallbackBaseUrl),
    [fallbackBaseUrl, params],
  );
  const hasHandledRef = useRef(false);
  const [inlineError, setInlineError] = useState(null);
  const { completeOAuthAuthentication, saveError, hydrated, completed } =
    useOnboarding();

  useEffect(() => {
    if (completed) {
      router.replace("/(tabs)");
    }
  }, [completed, router]);

  useEffect(() => {
    if (!hydrated || hasHandledRef.current) {
      return;
    }

    let isActive = true;

    const finalize = async () => {
      const initialLinkingUrl = await Linking.getInitialURL();
      const urlCandidates = [callbackUrl, initialLinkingUrl, derivedUrl].filter(
        Boolean,
      );
      const initialUrl =
        urlCandidates.find((value) => hasOAuthPayload(value)) ?? null;

      if (!initialUrl && !hasOAuthParams(params)) {
        return;
      }

      if (!initialUrl) {
        if (isActive) {
          setInlineError(
            "Missing OAuth callback URL. Please try signing in again.",
          );
        }
        return;
      }

      hasHandledRef.current = true;

      try {
        await completeOAuthAuthentication(initialUrl);
        if (isActive) {
          router.replace("/(tabs)");
        }
      } catch (error) {
        if (isActive) {
          setInlineError(
            error instanceof Error
              ? error.message
              : "Something went wrong while finishing sign in.",
          );
        }
      }
    };

    void finalize();

    return () => {
      isActive = false;
    };
  }, [
    callbackUrl,
    completeOAuthAuthentication,
    derivedUrl,
    hydrated,
    params,
    router,
  ]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />

      {inlineError || saveError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText} variant="body">
            {inlineError ?? saveError}
          </Text>
          <Pressable
            onPress={() => router.replace("/sign-in")}
            style={styles.button}
          >
            <Text style={styles.buttonText} variant="body">
              Back to login
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.errorBlock}>
          <Text style={styles.caption} variant="body">
            Finishing sign in...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    gap: 18,
  },
  caption: {
    color: colors.text,
    textAlign: "center",
  },
  errorBlock: {
    gap: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#D64545",
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
