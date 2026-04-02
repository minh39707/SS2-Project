import { useEffect } from "react";
import { Tabs } from "expo-router";
import AssistantChat from "@/src/components/layout/AssistantChat";
import BottomTab from "@/src/components/layout/BottomTab";
import { getDashboardData, listHabits } from "@/src/services/habit.service";
import { getCurrentUser, getUserStats } from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";

export default function TabLayout() {
  const { completed, hydrated, userProfile } = useOnboarding();

  useEffect(() => {
    if (!hydrated || !completed || !userProfile?.id) {
      return;
    }

    void Promise.allSettled([
      getCurrentUser(),
      getUserStats(),
      getDashboardData(),
      listHabits(userProfile),
    ]);
  }, [completed, hydrated, userProfile, userProfile?.accessToken, userProfile?.id]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          freezeOnBlur: true,
        }}
        tabBar={(props) => <BottomTab {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="analytics" options={{ title: "Phan tich" }} />
        <Tabs.Screen name="store" options={{ title: "Cua hang" }} />
        <Tabs.Screen name="settings" options={{ title: "Cai dat" }} />
      </Tabs>
      <AssistantChat variant="floating" />
    </>
  );
}
