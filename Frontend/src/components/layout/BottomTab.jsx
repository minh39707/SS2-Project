import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingButton from "@/src/components/layout/FloatingButton";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import { Text } from "@/src/components/ui/Text";
import { useOnboarding } from "@/src/store/OnboardingContext";

const iconMap = {
  index: { active: "home", idle: "home-outline" },
  analytics: { active: "stats-chart", idle: "stats-chart-outline" },
  store: { active: "bag-handle", idle: "bag-handle-outline" },
  settings: { active: "settings", idle: "settings-outline" },
};

export default function BottomTab({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { completed } = useOnboarding();
  const [isFabMenuVisible, setIsFabMenuVisible] = useState(false);

  const closeFabMenu = () => {
    setIsFabMenuVisible(false);
  };

  const handleFabPress = () => {
    if (!completed) {
      router.push("/welcome");
      return;
    }

    setIsFabMenuVisible((currentState) => !currentState);
  };

  const handleHabitTypePress = (habitType) => {
    closeFabMenu();
    router.push({
      pathname: "/habit-create",
      params: { habitType },
    });
  };

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
      <Modal
        animationType="fade"
        onRequestClose={closeFabMenu}
        transparent
        visible={isFabMenuVisible}
      >
        <View style={styles.menuModal}>
          <Pressable onPress={closeFabMenu} style={styles.menuBackdrop} />

          <View
            pointerEvents="box-none"
            style={[
              styles.menuContent,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.menuChoices}>
              <Pressable
                onPress={() => handleHabitTypePress("positive")}
                style={({ pressed }) => [
                  styles.menuCard,
                  styles.goodCard,
                  pressed && styles.menuCardPressed,
                ]}
              >
                <View style={styles.menuIconWrap}>
                  <Ionicons color={colors.primary} name="leaf-outline" size={24} />
                </View>
                <Text style={styles.menuCardTitle} variant="subtitle">
                  Good habit
                </Text>
                <Text color="muted" style={styles.menuCardText} variant="caption">
                  Build a routine you want to repeat.
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleHabitTypePress("negative")}
                style={({ pressed }) => [
                  styles.menuCard,
                  styles.badCard,
                  pressed && styles.menuCardPressed,
                ]}
              >
                <View style={[styles.menuIconWrap, styles.badIconWrap]}>
                  <Ionicons color="#B45309" name="ban-outline" size={24} />
                </View>
                <Text style={styles.menuCardTitle} variant="subtitle">
                  Bad habit
                </Text>
                <Text color="muted" style={styles.menuCardText} variant="caption">
                  Track something you want to reduce.
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalFabWrap}>
              <FloatingButton onPress={closeFabMenu} />
            </View>
          </View>
        </View>
      </Modal>

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
        <FloatingButton onPress={handleFabPress} />
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
  menuModal: {
    flex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.24)",
  },
  menuContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  menuChoices: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: 24,
    marginBottom: 34,
  },
  menuCard: {
    flex: 1,
    minHeight: 170,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: "space-between",
    ...shadows.card,
  },
  goodCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E6FF",
  },
  badCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  menuCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  menuIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EDF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  badIconWrap: {
    backgroundColor: "#FFEDD5",
  },
  menuCardTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  menuCardText: {
    lineHeight: 18,
  },
  modalFabWrap: {
    marginBottom: 8,
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
