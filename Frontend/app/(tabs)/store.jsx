import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import { getDashboardData } from "@/src/services/habit.service";
import {
  buyItem,
  equipItem,
  getStoreInventory,
  getStoreItems,
  sellItem,
  useItem as activateStoreItem,
} from "@/src/services/store.service";
import { getCurrentUser } from "@/src/services/user.service";

const SHOP_SECTIONS = [
  {
    id: "tier-1",
    title: "Tier 1",
    accent: "#18B981",
    items: [
      {
        id: "hp-small",
        name: "Small Heal",
        description: "Restore a small amount of HP.",
        effect: "+10 HP",
        price: 10,
        icon: "heart-outline",
        iconColor: "#16A34A",
        iconBg: "#DCFCE7",
      },
      {
        id: "exp-2x",
        name: "Double XP",
        description: "Double your XP reward once.",
        effect: "Boost",
        price: 20,
        icon: "star-outline",
        iconColor: "#0F9F6E",
        iconBg: "#D1FAE5",
      },
    ],
  },
];

function formatCoins(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildStatValue(stats, label, fallbackValue = 0, fallbackMax = 100) {
  const matched = stats?.find((item) => item.label === label);
  return {
    value: matched?.value ?? fallbackValue,
    max: matched?.max ?? fallbackMax,
  };
}

function chunkItems(items = [], size = 2) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function ShopItemRow({ item, onBuy, disabled, coinBalance }) {
  const canAfford = coinBalance >= item.price;

  return (
    <View style={styles.shopItem}>
      <View style={[styles.shopItemIcon, { backgroundColor: item.iconBg }]}>
        <Ionicons color={item.iconColor} name={item.icon} size={22} />
      </View>

      <View style={styles.shopItemBody}>
        <Text numberOfLines={1} style={styles.shopItemTitle} variant="body">
          {item.name}
        </Text>
        <Text numberOfLines={2} color="muted" style={styles.shopItemDescription} variant="caption">
          {item.description}
        </Text>
        <Text style={[styles.shopItemEffect, { color: item.iconColor }]} variant="caption">
          {item.effect}
        </Text>
      </View>

      <Pressable
        disabled={disabled || !canAfford}
        onPress={() => onBuy(item)}
        style={[styles.priceChip, !canAfford && styles.priceChipInsufficient]}
      >
        <View style={styles.priceCoinCircle}>
          <Ionicons color={canAfford ? "#FACC15" : "#94A3B8"} name="logo-usd" size={13} />
        </View>
        <Text style={[styles.priceChipText, !canAfford && styles.priceChipTextInsufficient]} variant="caption">
          {item.price}
        </Text>
      </Pressable>
    </View>
  );
}

function InventoryCard({ item, onUse, onSell, onEquip, disabled }) {
  const isEquippable = item.canEquip === true || item.primaryAction === "equip";
  const isUsable = item.canUse === true || item.primaryAction === "use";
  const primaryLabel = isEquippable ? (item.equipped ? "Unequip" : "Equip") : "Use";
  const isPrimaryDisabled = disabled || (!isEquippable && !isUsable);

  const handlePrimary = () => {
    if (isEquippable) {
      onEquip(item);
    } else if (isUsable) {
      onUse(item);
    }
  };

  return (
    <View style={[styles.inventoryCard, item.equipped && styles.inventoryCardEquipped]}>
      {item.equipped ? (
        <View style={styles.equippedBanner}>
          <Text style={styles.equippedBannerText} variant="caption">
            EQUIPPED
          </Text>
        </View>
      ) : null}

      <View style={styles.inventoryCountBadge}>
        <Text style={styles.inventoryCountBadgeText} variant="caption">
          x{item.quantity}
        </Text>
      </View>

      <View style={[styles.inventoryIconWrap, { backgroundColor: item.iconBg }]}>
        <Ionicons color={item.iconColor} name={item.icon} size={30} />
      </View>

      <Text numberOfLines={2} style={styles.inventoryName} variant="subtitle">
        {item.name}
      </Text>

      <Text numberOfLines={1} color="muted" style={styles.inventoryEffect} variant="caption">
        {item.effectLabel ?? item.effect ?? "Passive"}
      </Text>

      <Pressable
        disabled={isPrimaryDisabled}
        onPress={handlePrimary}
        style={[
          styles.inventoryButton,
          item.equipped && styles.inventoryButtonEquipped,
          isPrimaryDisabled && styles.inventoryButtonDisabled,
        ]}
      >
        <Text
          style={[
            styles.inventoryButtonText,
            item.equipped && styles.inventoryButtonTextEquipped,
          ]}
          variant="body"
        >
          {isUsable || isEquippable ? primaryLabel : "Passive"}
        </Text>
      </Pressable>

      {item.isTradeable ? (
        <Pressable
          disabled={disabled}
          onPress={() => onSell(item)}
          style={[styles.sellButton, disabled && styles.inventoryButtonDisabled]}
        >
          <Ionicons color="#D97706" name="logo-usd" size={12} />
          <Text style={styles.sellButtonText} variant="caption">
            Sell · {item.sellPrice}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function StoreScreen() {
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState("shop");
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [shopSections, setShopSections] = useState(SHOP_SECTIONS);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [localCoinBalance, setLocalCoinBalance] = useState(null);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    let isActive = true;

    const hydrate = async () => {
      setLoadingStore(true);
      setLocalCoinBalance(null);

      try {
        const [userProfile, dashboard, storeResponse, inventoryResponse] = await Promise.all([
          getCurrentUser({ forceRefresh: true }),
          getDashboardData({ forceRefresh: true }),
          getStoreItems(),
          getStoreInventory(),
        ]);

        if (!isActive) {
          return;
        }

        setProfile(userProfile);
        setDashboardData(dashboard ?? null);
        setShopSections(
          Array.isArray(storeResponse?.sections) && storeResponse.sections.length > 0
            ? storeResponse.sections
            : SHOP_SECTIONS,
        );
        setInventoryItems(
          Array.isArray(inventoryResponse?.items) ? inventoryResponse.items : [],
        );
      } catch (error) {
        if (__DEV__) {
          console.warn("Failed to load store profile", error);
        }
      } finally {
        if (isActive) {
          setLoadingStore(false);
        }
      }
    };

    void hydrate();

    return () => {
      isActive = false;
    };
  }, [isFocused]);

  const stats = dashboardData?.stats ?? [];
  const player = dashboardData?.player ?? null;
  const hp = buildStatValue(stats, "HP", player?.currentHp ?? 100, player?.maxHp ?? 100);
  const exp = buildStatValue(stats, "EXP", player?.currentExp ?? 0, player?.expToNextLevel ?? 100);
  const streak = buildStatValue(stats, "Streaks", 0, 7);
  const heroName = profile?.name ?? "Habit Hero";
  const baseCoinBalance = player?.goldCoins ?? profile?.goldCoins ?? 0;
  const coinBalance = localCoinBalance ?? baseCoinBalance;
  const level = player?.level ?? profile?.level ?? 1;
  const providerLabel = "Google sync";
  const hpProgress = hp.max > 0 ? Math.max(0, Math.min(1, hp.value / hp.max)) : 0;
  const expProgress = exp.max > 0 ? Math.max(0, Math.min(1, exp.value / exp.max)) : 0;
  const inventoryRows = useMemo(() => chunkItems(inventoryItems, 2), [inventoryItems]);

  const refreshInventory = useCallback(async () => {
    const inv = await getStoreInventory();
    if (Array.isArray(inv?.items)) {
      setInventoryItems(inv.items);
    }
  }, []);

  const handleBuy = useCallback(
    (item) => {
      if (actionLoading) return;

      if (coinBalance < item.price) {
        Alert.alert("Không đủ vàng", `Bạn cần ${item.price} vàng để mua "${item.name}".`);
        return;
      }

      Alert.alert(
        "Mua vật phẩm",
        `Mua "${item.name}" với ${item.price} vàng?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Mua",
            onPress: async () => {
              setActionLoading(true);
              try {
                const result = await buyItem(item.id);
                setLocalCoinBalance(result.gold_coins);
                await refreshInventory();
                Alert.alert("Mua thành công!", `"${item.name}" đã được thêm vào kho đồ.`);
              } catch (err) {
                Alert.alert("Lỗi", err?.message ?? "Không thể mua vật phẩm.");
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [actionLoading, coinBalance, refreshInventory],
  );

  const handleUse = useCallback(
    (item) => {
      if (actionLoading) return;

      Alert.alert(
        "Sử dụng vật phẩm",
        `Sử dụng "${item.name}"?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Sử dụng",
            onPress: async () => {
              setActionLoading(true);
              try {
                const result = await activateStoreItem(item.id);
                if (result.character?.gold_coins !== undefined) {
                  setLocalCoinBalance(result.character.gold_coins);
                }
                const [inv, dash] = await Promise.all([
                  getStoreInventory(),
                  getDashboardData({ forceRefresh: true }),
                ]);
                if (Array.isArray(inv?.items)) setInventoryItems(inv.items);
                if (dash) setDashboardData(dash);
                Alert.alert("Đã sử dụng!", result.message ?? `"${item.name}" đã được kích hoạt.`);
              } catch (err) {
                Alert.alert("Lỗi", err?.message ?? "Không thể sử dụng vật phẩm.");
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [actionLoading],
  );

  const handleSell = useCallback(
    (item) => {
      if (actionLoading) return;

      Alert.alert(
        "Bán vật phẩm",
        `Bán "${item.name}" được ${item.sellPrice} vàng?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Bán",
            style: "destructive",
            onPress: async () => {
              setActionLoading(true);
              try {
                const result = await sellItem(item.id);
                setLocalCoinBalance(result.gold_coins);
                await refreshInventory();
                Alert.alert("Đã bán!", `Nhận được ${item.sellPrice} vàng.`);
              } catch (err) {
                Alert.alert("Lỗi", err?.message ?? "Không thể bán vật phẩm.");
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [actionLoading, refreshInventory],
  );

  const handleEquip = useCallback(
    async (item) => {
      if (actionLoading) return;
      setActionLoading(true);
      try {
        await equipItem(item.id, !item.equipped);
        await refreshInventory();
      } catch (err) {
        Alert.alert("Lỗi", err?.message ?? "Không thể trang bị vật phẩm.");
      } finally {
        setActionLoading(false);
      }
    },
    [actionLoading, refreshInventory],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(420)} style={styles.headerRow}>
          <Text style={styles.headerTitle} variant="title">
            Store
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(470).delay(60)}>
          <Card style={styles.playerCard}>
            <View style={styles.playerTop}>
              <View style={styles.avatarWrap}>
                <ProfileAvatar
                  avatarUrl={profile?.avatarUrl ?? null}
                  name={heroName}
                  seed={profile?.id ?? heroName}
                  size={60}
                  style={styles.avatarCircle}
                  textStyle={styles.avatarText}
                />
                <View style={styles.levelPill}>
                  <Text color="primary" style={styles.levelPillText} variant="caption">
                    LV {level}
                  </Text>
                </View>
              </View>

              <View style={styles.playerInfo}>
                <View style={styles.playerHeader}>
                  <View style={styles.playerHeaderCopy}>
                    <Text style={styles.playerName} variant="subtitle">
                      {heroName}
                    </Text>
                    <Text color="muted" variant="caption">
                      {providerLabel}
                    </Text>
                  </View>

                  <View style={styles.streakBadge}>
                    <Text style={styles.streakText} variant="label">
                      {streak.value}
                    </Text>
                    <Ionicons color="#F59E0B" name="flame" size={14} />
                  </View>

                  <View style={styles.goldBadge}>
                    <View style={styles.goldIconCircle}>
                      <Ionicons color="#FFFFFF" name="logo-usd" size={16} />
                    </View>
                    <Text style={styles.goldText} variant="label">
                      {formatCoins(coinBalance)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statGroup}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel} variant="caption">
                      HP
                    </Text>
                    <Text style={styles.statValue} variant="caption">
                      {hp.value}/{hp.max}
                    </Text>
                  </View>
                  <View style={styles.statTrack}>
                    <View
                      style={[
                        styles.statFill,
                        styles.hpFill,
                        { width: `${Math.max(8, hpProgress * 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.statGroup}>
                  <View style={styles.statLabelRow}>
                    <Text style={styles.statLabel} variant="caption">
                      EXP
                    </Text>
                    <Text style={styles.statValue} variant="caption">
                      {exp.value}/{exp.max}
                    </Text>
                  </View>
                  <View style={styles.statTrack}>
                    <View
                      style={[
                        styles.statFill,
                        styles.expFill,
                        { width: `${Math.max(8, expProgress * 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.playerHint}>
                  <Ionicons color={colors.primary} name="flash-outline" size={14} />
                  <Text color="muted" style={styles.playerHintText} variant="caption">
                    Complete habits to gain EXP. Missing core habits may cost HP.
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(520).delay(100)} style={styles.controlRow}>
          <View style={styles.segmentedControl}>
            <Pressable
              onPress={() => setActiveTab("shop")}
              style={[
                styles.segmentButton,
                activeTab === "shop" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "shop" && styles.segmentTextActive,
                ]}
                variant="subtitle"
              >
                Shop
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("inventory")}
              style={[
                styles.segmentButton,
                activeTab === "inventory" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "inventory" && styles.segmentTextActive,
                ]}
                variant="subtitle"
              >
                Inventory
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {activeTab === "shop" ? (
          <Animated.View entering={FadeInDown.duration(560).delay(140)} style={styles.sectionsWrap}>
            {shopSections.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionAccent, { backgroundColor: section.accent }]} />
                  <Text style={styles.sectionTitle} variant="subtitle">
                    {section.title}
                  </Text>
                </View>

                {loadingStore ? (
                  <View style={styles.inventoryEmptyCard}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.inventoryEmptyText} variant="body">
                      Loading store...
                    </Text>
                  </View>
                ) : section.items.length > 0 ? (
                  <View style={styles.shopList}>
                    {section.items.map((item) => (
                      <ShopItemRow
                        coinBalance={coinBalance}
                        disabled={actionLoading}
                        item={item}
                        key={item.id}
                        onBuy={handleBuy}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyTierCard} />
                )}
              </View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(560).delay(140)} style={styles.inventorySection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: "#2563EB" }]} />
              <Text style={styles.sectionTitle} variant="subtitle">
                Inventory
              </Text>
            </View>

            {loadingStore ? (
              <View style={styles.inventoryEmptyCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.inventoryEmptyText} variant="body">
                  Loading inventory...
                </Text>
              </View>
            ) : inventoryItems.length > 0 ? (
              <View style={styles.inventoryGrid}>
                {inventoryRows.map((row, rowIndex) => (
                  <View key={`inventory-row-${rowIndex}`} style={styles.inventoryRow}>
                    {row.map((item) => (
                      <InventoryCard
                        disabled={actionLoading}
                        item={item}
                        key={item.id}
                        onEquip={handleEquip}
                        onSell={handleSell}
                        onUse={handleUse}
                      />
                    ))}

                    {row.length === 1 ? <View style={styles.inventoryCardPlaceholder} /> : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.inventoryEmptyCard}>
                <Ionicons color="#94A3B8" name="cube-outline" size={22} />
                <Text style={styles.inventoryEmptyText} variant="body">
                  Your inventory is empty.
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.xxl * 4,
    gap: spacing.lg,
  },
  headerRow: {
    paddingHorizontal: 6,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
  },
  playerCard: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
    borderRadius: 24,
  },
  playerTop: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  avatarWrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#D9E8FF",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
  },
  levelPillText: {
    fontWeight: "700",
  },
  playerInfo: {
    flex: 1,
    gap: 8,
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    alignItems: "center",
  },
  playerHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontSize: 18,
    lineHeight: 22,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFE29A",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  streakText: {
    color: "#8A5400",
    fontWeight: "700",
  },
  goldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF9E8",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.25,
    borderColor: "#F8DD7D",
  },
  goldIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFC323",
  },
  goldText: {
    color: "#D97706",
    fontWeight: "700",
    fontSize: 13,
  },
  statGroup: {
    gap: 3,
  },
  statLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "#DCE7F8",
    overflow: "hidden",
  },
  statFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  hpFill: {
    backgroundColor: "#EF5B64",
  },
  expFill: {
    backgroundColor: "#467EE8",
  },
  statLabel: {
    color: "#475569",
    fontWeight: "700",
  },
  statValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  controlRow: {
    alignItems: "center",
    gap: spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    padding: 6,
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 17,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  playerHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  playerHintText: {
    flex: 1,
    lineHeight: 17,
  },
  sectionsWrap: {
    gap: spacing.lg,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionAccent: {
    width: 5,
    height: 18,
    borderRadius: radii.pill,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
  },
  shopList: {
    gap: 10,
  },
  shopItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopItemIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  shopItemBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  shopItemTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  shopItemDescription: {
    color: colors.textMuted,
    lineHeight: 18,
  },
  shopItemEffect: {
    fontWeight: "700",
  },
  priceChip: {
    minWidth: 68,
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...shadows.soft,
  },
  priceChipInsufficient: {
    backgroundColor: colors.surfaceMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  priceCoinCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFF4B8",
    alignItems: "center",
    justifyContent: "center",
  },
  priceChipText: {
    color: "#FFE066",
    fontWeight: "800",
    fontSize: 12,
  },
  priceChipTextInsufficient: {
    color: colors.textMuted,
  },
  emptyTierCard: {
    height: 16,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
  },
  inventorySection: {
    gap: spacing.md,
  },
  inventoryGrid: {
    gap: spacing.md,
  },
  inventoryRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  inventoryCard: {
    flex: 1,
    minHeight: 280,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  inventoryCardPlaceholder: {
    flex: 1,
  },
  inventoryCardEquipped: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  equippedBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primarySoft,
    paddingVertical: 8,
    alignItems: "center",
  },
  equippedBannerText: {
    color: colors.primary,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  inventoryCountBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
  },
  inventoryCountBadgeText: {
    color: colors.primary,
    fontWeight: "800",
  },
  inventoryIconWrap: {
    width: 88,
    height: 88,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryName: {
    textAlign: "center",
    color: colors.text,
    minHeight: 44,
    paddingHorizontal: 6,
  },
  inventoryEffect: {
    textAlign: "center",
    fontWeight: "700",
    minHeight: 18,
  },
  inventoryButton: {
    marginTop: "auto",
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  inventoryButtonEquipped: {
    backgroundColor: colors.primarySoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  inventoryButtonDisabled: {
    opacity: 0.5,
  },
  inventoryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
  },
  inventoryButtonTextEquipped: {
    color: colors.primary,
  },
  sellButton: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: "#FFF9E8",
    borderWidth: 1,
    borderColor: "#F8DD7D",
  },
  sellButtonText: {
    color: "#D97706",
    fontWeight: "700",
  },
  inventoryEmptyCard: {
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inventoryEmptyText: {
    color: colors.textMuted,
  },
});
