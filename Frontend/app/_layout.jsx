import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
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
    return (<OnboardingProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index"/>
          <Stack.Screen name="auth-callback"/>
          <Stack.Screen name="(onboarding)"/>
          <Stack.Screen name="(auth)"/>
          <Stack.Screen name="(tabs)"/>
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }}/>
        </Stack>
        <StatusBar style="dark"/>
      </ThemeProvider>
    </OnboardingProvider>);
}

