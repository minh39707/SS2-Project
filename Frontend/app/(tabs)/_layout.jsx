import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { InteractionManager } from "react-native";
import AssistantChat from "@/src/components/layout/AssistantChat";
import BottomTab from "@/src/components/layout/BottomTab";
import {
  clearManagedHabitNotifications,
  syncHabitNotificationsForUser,
} from "@/src/services/habitNotifications";
import { getDashboardData, listHabits } from "@/src/services/habit.service";
import { getCurrentUser } from "@/src/services/user.service";
import { useOnboarding } from "@/src/store/OnboardingContext";

export default function TabLayout() {
  const { completed, hydrated, userProfile } = useOnboarding();
  const previousUserIdRef = useRef(null);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = userProfile?.id ?? null;

    if (previousUserId && previousUserId !== currentUserId) {
      void clearManagedHabitNotifications(previousUserId);
    }

    previousUserIdRef.current = currentUserId;
  }, [userProfile?.id]);

  useEffect(() => {
    if (!hydrated || !completed || !userProfile?.id) {
      return;
    }

    let isCancelled = false;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      void Promise.allSettled([getCurrentUser(), getDashboardData()]);

      void (async () => {
        try {
          const habitsResult = await listHabits(userProfile);

          if (isCancelled) {
            return;
          }

          await syncHabitNotificationsForUser({
            userId: userProfile.id,
            authToken: userProfile.accessToken,
            habits: habitsResult?.habits ?? [],
            requestPermissions: false,
          });
        } catch (error) {
          if (__DEV__) {
            console.warn("Failed to sync habit notifications during app preload", error);
          }
        }
      })();
    });

    return () => {
      isCancelled = true;
      interactionTask.cancel?.();
    };
  }, [completed, hydrated, userProfile, userProfile?.accessToken, userProfile?.id]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
        }}
        tabBar={(props) => <BottomTab {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
        <Tabs.Screen name="store" options={{ title: "Store" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
      <AssistantChat variant="floating" />
    </>
  );
}
