import { Tabs } from "expo-router";
import AssistantChat from "@/src/components/layout/AssistantChat";
import BottomTab from "@/src/components/layout/BottomTab";

export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
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
