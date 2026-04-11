import { useEffect, useRef } from "react";
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { colors } from '@/src/constants/colors';
import { OnboardingProvider } from '@/src/store/OnboardingContext';
const navigationTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        primary: colors.primary,
        text: colors.text,
        border: colors.border,
    },
};
export default function RootLayout() {
    const router = useRouter();
    const lastNotificationResponse = Notifications.useLastNotificationResponse();
    const lastHandledNotificationIdRef = useRef(null);

    useEffect(() => {
        const notificationId = lastNotificationResponse?.notification?.request?.identifier ?? null;
        const url = lastNotificationResponse?.notification?.request?.content?.data?.url;
        const actionIdentifier = lastNotificationResponse?.actionIdentifier;

        if (
            actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
            !notificationId ||
            lastHandledNotificationIdRef.current === notificationId
        ) {
            return;
        }

        lastHandledNotificationIdRef.current = notificationId;

        if (typeof url === "string") {
            router.replace(url);
        }
    }, [lastNotificationResponse, router]);

    return (<OnboardingProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index"/>
          <Stack.Screen name="auth-callback"/>
          <Stack.Screen name="habit-focus"/>
          <Stack.Screen name="(onboarding)"/>
          <Stack.Screen name="(auth)"/>
          <Stack.Screen name="(tabs)"/>
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }}/>
        </Stack>
        <StatusBar style="dark"/>
      </ThemeProvider>
    </OnboardingProvider>);
}

