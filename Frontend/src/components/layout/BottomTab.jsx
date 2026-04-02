import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingButton from "@/src/components/layout/FloatingButton";
import { colors } from "@/src/constants/colors";
import { radii, shadows } from "@/src/constants/theme";

const iconMap = {
  index: { active: "home", idle: "home-outline" },
  analytics: { active: "stats-chart", idle: "stats-chart-outline" },
  store: { active: "bag-handle", idle: "bag-handle-outline" },
  settings: { active: "settings", idle: "settings-outline" },
};

export default function BottomTab({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const renderItem = (route, index) => {
    const focused = state.index === index;

    const onPress = () => {
      void Haptics.selectionAsync();
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <View style={styles.iconShell}>
          <Ionicons
            color={focused ? colors.primary : "#111827"}
            name={focused ? iconMap[route.name].active : iconMap[route.name].idle}
            size={28}
          />
        </View>
        {focused ? <View style={styles.activeIndicator} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.shell}>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.group}>
          {state.routes.slice(0, 2).map((route, index) => renderItem(route, index))}
        </View>

        <View style={styles.centerSlot} />

        <View style={styles.group}>
          {state.routes.slice(2).map((route, index) => renderItem(route, index + 2))}
        </View>
      </View>

      <View style={styles.fabWrap}>
        <FloatingButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    minHeight: 72,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderColor: "#E8EDF5",
    ...shadows.card,
  },
  group: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  centerSlot: {
    width: 92,
  },
  item: {
    width: 52,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xl,
  },
  itemPressed: {
    opacity: 0.82,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIndicator: {
    marginTop: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  fabWrap: {
    position: "absolute",
    top: -28,
  },
});
