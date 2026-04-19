import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text } from "@/src/components/ui/Text";
import { radii, shadows, spacing } from "@/src/constants/theme";
import { getDashboardData } from "@/src/services/habit.service";
import { getCurrentUser } from "@/src/services/user.service";

const heroAvatar =
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=400&q=80";

const SHOP_SECTIONS = [
  {
    id: "tier-1",
    title: "Cấp 1",
    accent: "#18B981",
    items: [
      {
        id: "hp-small",
        name: "Hồi phục nhỏ",
        description: "Hồi một ít máu",
        effect: "+10 HP",
        price: 10,
        icon: "heart-outline",
        iconColor: "#16A34A",
        iconBg: "#DCFCE7",
      },
      {
        id: "exp-2x",
        name: "Tăng kinh nghiệm x2",
        description: "Nhân đôi kinh nghiệm",
        effect: "Buff",
        price: 20,
        icon: "star-outline",
        iconColor: "#0F9F6E",
        iconBg: "#D1FAE5",
      },
      {
        id: "streak-guard",
        name: "Giữ chuỗi",
        description: "Bảo vệ chuỗi 1 ngày",
        effect: "Bảo vệ",
        price: 25,
        icon: "shield-outline",
        iconColor: "#059669",
        iconBg: "#D1FAE5",
      },
      {
        id: "focus-reminder",
        name: "Nhắc nhở tăng cường",
        description: "Thông báo nổi bật",
        effect: "Tiện ích",
        price: 15,
        icon: "notifications-outline",
        iconColor: "#10B981",
        iconBg: "#D1FAE5",
      },
      {
        id: "quest-exp",
        name: "Phần thưởng nhiệm vụ x2",
        description: "Nhân đôi thưởng nhiệm vụ",
        effect: "Buff",
        price: 30,
        icon: "calendar-outline",
        iconColor: "#059669",
        iconBg: "#D1FAE5",
      },
      {
        id: "skip-quest",
        name: "Bỏ qua nhiệm vụ",
        description: "Bỏ qua 1 nhiệm vụ",
        effect: "Đặc biệt",
        price: 35,
        icon: "play-forward-outline",
        iconColor: "#10B981",
        iconBg: "#D1FAE5",
      },
      {
        id: "small-bag",
        name: "Rương thưởng nhỏ",
        description: "Mở ra phần thưởng nhỏ",
        effect: "Dachu",
        price: 20,
        icon: "file-tray-outline",
        iconColor: "#059669",
        iconBg: "#D1FAE5",
      },
    ],
  },
  {
    id: "tier-2",
    title: "Cấp 2",
    accent: "#3B82F6",
    items: [
      {
        id: "hp-medium",
        name: "Hồi phục trung",
        description: "Hồi lượng máu vừa",
        effect: "+20 HP",
        price: 40,
        icon: "heart-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "shield-chain",
        name: "Khiên chuỗi",
        description: "Bảo vệ chuỗi",
        effect: "Bảo vệ",
        price: 60,
        icon: "shield-half-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "quest-exp-boost",
        name: "Tăng EXP theo nhiệm vụ khó",
        description: "Tăng thưởng EXP cho nhiệm vụ khó",
        effect: "Buff",
        price: 50,
        icon: "trending-up-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "reduce-difficulty",
        name: "Giảm độ khó",
        description: "Giảm độ yêu cầu nhiệm vụ",
        effect: "Hỗ trợ",
        price: 55,
        icon: "arrow-down-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "energy-up",
        name: "Tăng năng lượng",
        description: "Hồi phục thêm năng lượng",
        effect: "Tích hợp",
        price: 60,
        icon: "flash-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "medium-chest",
        name: "Rương thưởng trung",
        description: "Mở ra phần thưởng vừa",
        effect: "Cách tân",
        price: 45,
        icon: "wallet-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
      {
        id: "instant-complete",
        name: "Hoàn thành nhanh",
        description: "Hoàn tất hoàn thành ngay",
        effect: "Tiện ích",
        price: 70,
        icon: "checkmark-done-outline",
        iconColor: "#2563EB",
        iconBg: "#DBEAFE",
      },
    ],
  },
  {
    id: "tier-3",
    title: "Cấp 3",
    accent: "#A855F7",
    items: [
      {
        id: "hp-large",
        name: "Hồi phục lớn",
        description: "Hồi lượng máu lớn",
        effect: "+40 HP",
        price: 80,
        icon: "heart-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "streak-plus",
        name: "Giữ chuỗi nâng cao",
        description: "Bảo vệ chuỗi 2 ngày",
        effect: "Bảo vệ",
        price: 90,
        icon: "shield-checkmark-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "exp-3x-lite",
        name: "Tăng EXP x2",
        description: "Nhân đôi kinh nghiệm lâu hơn",
        effect: "Buff",
        price: 100,
        icon: "star-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "rewind",
        name: "Quay lại chuỗi",
        description: "Khôi phục chuỗi đã mất",
        effect: "Hiếm",
        price: 110,
        icon: "refresh-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "pet",
        name: "Thú đồng hành sơ bản",
        description: "Đồng hành mới",
        effect: "Hiếm",
        price: 95,
        icon: "paw-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "focus-mode",
        name: "Chế độ tập trung",
        description: "Kích hoạt chế độ tập trung cao",
        effect: "Tiện ích",
        price: 85,
        icon: "scan-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
      {
        id: "large-chest",
        name: "Rương thưởng lớn",
        description: "Mở ra phần thưởng lớn",
        effect: "Dachu",
        price: 90,
        icon: "briefcase-outline",
        iconColor: "#9333EA",
        iconBg: "#F3E8FF",
      },
    ],
  },
  {
    id: "tier-4",
    title: "Cấp 4 (Hiếm)",
    accent: "#EF4444",
    items: [
      {
        id: "full-heal",
        name: "Hồi phục toàn phần",
        description: "Hồi đầy máu",
        effect: "+100 HP",
        price: 130,
        icon: "medkit-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
      {
        id: "exp-3x",
        name: "Tăng EXP x3",
        description: "Nhân ba kinh nghiệm",
        effect: "Buff",
        price: 140,
        icon: "sparkles-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
      {
        id: "rare-chain",
        name: "Nhẫn thưởng chuỗi",
        description: "Tăng thưởng chuỗi",
        effect: "Hiếm",
        price: 150,
        icon: "sunny-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
      {
        id: "challenge-ticket",
        name: "Vé thử thách",
        description: "Tham gia thử thách đặc biệt",
        effect: "Sự kiện",
        price: 120,
        icon: "ticket-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
      {
        id: "premium-contract",
        name: "Hợp đồng cam kết",
        description: "Cam kết nhận thưởng lớn",
        effect: "Đặc biệt",
        price: 138,
        icon: "diamond-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
      {
        id: "mystery-box",
        name: "Hộp may rủi",
        description: "Mở ra vật phẩm ngẫu nhiên",
        effect: "Cách tân",
        price: 125,
        icon: "gift-outline",
        iconColor: "#EF4444",
        iconBg: "#FEE2E2",
      },
    ],
  },
  {
    id: "tier-5",
    title: "Cấp 5 (Cao cấp)",
    accent: "#EAB308",
    items: [
      {
        id: "exp-5x",
        name: "Tăng EXP x5 (1 ngày)",
        description: "Buff cực mạnh, rủi ro cao",
        effect: "Huyền thoại",
        price: 180,
        icon: "rocket-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
      {
        id: "instant-level",
        name: "Lên cấp ngay",
        description: "Tăng 1 level lập tức",
        effect: "Cao cấp",
        price: 200,
        icon: "trending-up-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
      {
        id: "super-streak-shield",
        name: "Siêu khiên chuỗi",
        description: "Bảo vệ streak 7 ngày",
        effect: "Hiếm đặc biệt",
        price: 170,
        icon: "shield-checkmark-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
      {
        id: "quest-reward-3x",
        name: "Nhân 3 phần thưởng nhiệm vụ",
        description: "Áp dụng cho 1 task",
        effect: "Buff nhiệm vụ",
        price: 160,
        icon: "layers-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
      {
        id: "premium-pet",
        name: "Thú đồng hành cao cấp",
        description: "Boost EXP + bonus đặc biệt",
        effect: "Đồng hành",
        price: 175,
        icon: "paw-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
      {
        id: "legendary-chest",
        name: "Rương huyền thoại",
        description: "Reward cực hiếm",
        effect: "Huyền thoại",
        price: 190,
        icon: "diamond-outline",
        iconColor: "#CA8A04",
        iconBg: "#FEF3C7",
      },
    ],
  },
];

const INVENTORY_ITEMS = [
  {
    id: "inv-hp-small",
    name: "Hồi phục nhỏ",
    icon: "heart",
    iconColor: "#16A34A",
    iconBg: "#DCFCE7",
    quantity: 5,
    equipped: false,
  },
  {
    id: "inv-exp",
    name: "x2 EXP (1 ngày)",
    icon: "flash",
    iconColor: "#2563EB",
    iconBg: "#DBEAFE",
    quantity: 2,
    equipped: false,
  },
  {
    id: "inv-streak",
    name: "Giữ chuỗi",
    icon: "flame",
    iconColor: "#EA580C",
    iconBg: "#FFEDD5",
    quantity: 3,
    equipped: false,
  },
  {
    id: "inv-shield",
    name: "Khiên chuỗi",
    icon: "shield",
    iconColor: "#9333EA",
    iconBg: "#F3E8FF",
    quantity: 1,
    equipped: false,
  },
  {
    id: "inv-bag",
    name: "Rương nhỏ",
    icon: "briefcase",
    iconColor: "#CA8A04",
    iconBg: "#FEF9C3",
    quantity: 4,
    equipped: false,
  },
  {
    id: "inv-pet",
    name: "Thú đồng hành",
    icon: "paw",
    iconColor: "#DB2777",
    iconBg: "#FCE7F3",
    quantity: 1,
    equipped: true,
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

function ShopItemRow({ item }) {
  return (
    <View style={styles.shopItem}>
      <View style={[styles.shopItemIcon, { backgroundColor: item.iconBg }]}>
        <Ionicons color={item.iconColor} name={item.icon} size={22} />
      </View>

      <View style={styles.shopItemBody}>
        <Text numberOfLines={1} style={styles.shopItemTitle} variant="body">
          {item.name}
        </Text>
        <Text numberOfLines={1} color="muted" style={styles.shopItemDescription} variant="caption">
          {item.description}
        </Text>
        <Text style={[styles.shopItemEffect, { color: item.iconColor }]} variant="caption">
          {item.effect}
        </Text>
      </View>

      <Pressable style={styles.priceChip}>
        <View style={styles.priceCoinCircle}>
          <Ionicons color="#FACC15" name="logo-usd" size={13} />
        </View>
        <Text style={styles.priceChipText} variant="caption">
          {item.price}
        </Text>
      </Pressable>
    </View>
  );
}

function InventoryCard({ item }) {
  return (
    <View style={[styles.inventoryCard, item.equipped && styles.inventoryCardEquipped]}>
      {item.equipped ? (
        <View style={styles.equippedBanner}>
          <Text style={styles.equippedBannerText} variant="caption">
            DANG TRANG BG
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

      <Pressable
        style={[
          styles.inventoryButton,
          item.equipped && styles.inventoryButtonEquipped,
        ]}
      >
        <Text
          style={[
            styles.inventoryButtonText,
            item.equipped && styles.inventoryButtonTextEquipped,
          ]}
          variant="body"
        >
          {item.equipped ? "Tháo" : "Dùng"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function StoreScreen() {
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState("shop");
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const inventoryItems = useMemo(() => INVENTORY_ITEMS.slice(0, 0), []);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    let isActive = true;

    const hydrate = async () => {
      try {
        const [userProfile, dashboard] = await Promise.all([
          getCurrentUser({ forceRefresh: true }),
          getDashboardData({ forceRefresh: true }),
        ]);

        if (!isActive) {
          return;
        }

        setProfile(userProfile);
        setDashboardData(dashboard ?? null);
      } catch (error) {
        if (__DEV__) {
          console.warn("Failed to load store profile", error);
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
  const hp = useMemo(() => buildStatValue(stats, "HP", 100, 100), [stats]);
  const exp = useMemo(() => buildStatValue(stats, "EXP", 100, 100), [stats]);
  const streak = useMemo(() => buildStatValue(stats, "Streaks", 0, 7), [stats]);
  const heroName = profile?.name ?? "Hero Name";
  const coinBalance = player?.goldCoins ?? profile?.goldCoins ?? 0;
  const level = player?.level ?? profile?.level ?? 1;
  const inventoryRows = useMemo(() => chunkItems(inventoryItems, 2), [inventoryItems]);

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(420)} style={styles.headerRow}>
          <Text style={styles.headerTitle} variant="title">
            Cửa hàng
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(470).delay(60)} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: profile?.avatarUrl ?? heroAvatar }} style={styles.heroAvatar} />
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText} variant="caption">
                  LV {level}
                </Text>
              </View>
            </View>

            <View style={styles.heroMeta}>
              <View style={styles.heroHeaderTop}>
                <View style={styles.heroTitleBlock}>
                  <Text style={styles.heroName} variant="subtitle">
                    {heroName}
                  </Text>
                  <Text color="muted" style={styles.heroSubtitle} variant="caption">
                    Google sync
                  </Text>
                </View>

                <View style={styles.streakBadge}>
                  <Ionicons color="#F59E0B" name="flame" size={14} />
                  <Text style={styles.streakText} variant="caption">
                    {streak.value}
                  </Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statLabels}>
                  <Text style={styles.hpLabel} variant="label">
                    HP
                  </Text>
                  <Text style={styles.hpValue} variant="label">
                    {hp.value}/{hp.max}
                  </Text>
                </View>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      styles.hpFill,
                      { width: `${Math.max(8, Math.min(100, (hp.value / hp.max) * 100))}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statLabels}>
                  <Text style={styles.expLabel} variant="label">
                    EXP
                  </Text>
                  <Text style={styles.expValue} variant="label">
                    {exp.value}/{exp.max}
                  </Text>
                </View>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      styles.expFill,
                      { width: `${Math.max(8, Math.min(100, (exp.value / exp.max) * 100))}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
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
                Cửa hàng
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
                Túi đồ
              </Text>
            </Pressable>
          </View>

          <View style={styles.coinBadge}>
            <View style={styles.coinIconCircle}>
              <Ionicons color="#FFFFFF" name="logo-usd" size={18} />
            </View>
            <Text style={styles.coinBadgeText} variant="subtitle">
              {formatCoins(coinBalance)}
            </Text>
          </View>
        </Animated.View>

        {activeTab === "shop" ? (
          <Animated.View entering={FadeInDown.duration(560).delay(140)} style={styles.sectionsWrap}>
            {SHOP_SECTIONS.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionAccent, { backgroundColor: section.accent }]} />
                  <Text style={styles.sectionTitle} variant="subtitle">
                    {section.title}
                  </Text>
                </View>

                {section.items.length > 0 ? (
                  <View style={styles.shopList}>
                    {section.items.map((item) => (
                      <ShopItemRow item={item} key={item.id} />
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
                Túi đồ
              </Text>
            </View>

            {inventoryItems.length > 0 ? (
              <View style={styles.inventoryGrid}>
                {inventoryRows.map((row, rowIndex) => (
                  <View key={`inventory-row-${rowIndex}`} style={styles.inventoryRow}>
                    {row.map((item) => (
                      <InventoryCard item={item} key={item.id} />
                    ))}

                    {row.length === 1 ? <View style={styles.inventoryCardPlaceholder} /> : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.inventoryEmptyCard}>
                <Ionicons color="#94A3B8" name="cube-outline" size={22} />
                <Text style={styles.inventoryEmptyText} variant="body">
                  Túi đồ hiện đang trống.
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
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#EEF2FF",
  },
  headerTitle: {
    color: "#3457B2",
    fontSize: 22,
    lineHeight: 28,
  },
  heroCard: {
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E5FB",
    borderRadius: 24,
    padding: spacing.md,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  avatarWrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#D9E8FF",
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "#FFFFFF",
  },
  levelPillText: {
    color: "#3457B2",
    fontWeight: "700",
  },
  heroMeta: {
    flex: 1,
    gap: 8,
  },
  heroHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    alignItems: "center",
  },
  heroTitleBlock: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    fontSize: 18,
    lineHeight: 22,
    color: "#0F172A",
  },
  heroSubtitle: {
    lineHeight: 16,
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
  statRow: {
    gap: 3,
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
    backgroundColor: "#FF4D5E",
  },
  expFill: {
    backgroundColor: "#1877D9",
  },
  statLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hpLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  hpValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  expLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  expValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  controlRow: {
    alignItems: "center",
    gap: spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#C9D6FF",
    borderRadius: radii.pill,
    padding: 6,
    width: 180,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#FFFFFF",
    ...shadows.soft,
  },
  segmentText: {
    color: "#1665B7",
    fontSize: 17,
  },
  segmentTextActive: {
    color: "#0A67BA",
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
    backgroundColor: "#FFF9E8",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#F8DD7D",
  },
  coinIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFC323",
    alignItems: "center",
    justifyContent: "center",
  },
  coinBadgeText: {
    color: "#F2B705",
    fontSize: 18,
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
    color: "#0F172A",
    fontSize: 22,
  },
  shopList: {
    gap: 10,
  },
  shopItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF1F6",
    paddingHorizontal: 10,
    paddingVertical: 12,
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
  },
  shopItemTitle: {
    color: "#101828",
    fontWeight: "700",
  },
  shopItemDescription: {
    color: "#4B5563",
  },
  shopItemEffect: {
    fontWeight: "700",
  },
  priceChip: {
    minWidth: 74,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#1F5FBF",
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...shadows.soft,
  },
  priceCoinCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFF4B8",
    alignItems: "center",
    justifyContent: "center",
  },
  priceChipText: {
    color: "#FFE066",
    fontWeight: "800",
  },
  emptyTierCard: {
    height: 16,
    backgroundColor: "#EEF1F6",
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
    backgroundColor: "#E7EDFF",
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  inventoryCardPlaceholder: {
    flex: 1,
  },
  inventoryCardEquipped: {
    borderWidth: 1.5,
    borderColor: "#BFD2F7",
  },
  equippedBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#D7E4FF",
    paddingVertical: 8,
    alignItems: "center",
  },
  equippedBannerText: {
    color: "#0A67BA",
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
    backgroundColor: "#CFE0FF",
    alignItems: "center",
  },
  inventoryCountBadgeText: {
    color: "#2563EB",
    fontWeight: "800",
  },
  inventoryIconWrap: {
    width: 102,
    height: 102,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryName: {
    textAlign: "center",
    color: "#243B67",
    minHeight: 58,
    paddingHorizontal: 6,
  },
  inventoryButton: {
    marginTop: "auto",
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2B6FC3",
    ...shadows.card,
  },
  inventoryButtonEquipped: {
    backgroundColor: "#C9D8FF",
    shadowOpacity: 0,
    elevation: 0,
  },
  inventoryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
  },
  inventoryButtonTextEquipped: {
    color: "#D62839",
  },
  inventoryEmptyCard: {
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  inventoryEmptyText: {
    color: "#64748B",
  },
});
