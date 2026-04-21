const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");

const router = express.Router();

const STORE_SECTIONS = [
  { id: "common", rarity: "common", title: "Tier 1", accent: "#18B981" },
  { id: "uncommon", rarity: "uncommon", title: "Tier 2", accent: "#3B82F6" },
  { id: "rare", rarity: "rare", title: "Tier 3", accent: "#A855F7" },
  { id: "epic", rarity: "epic", title: "Tier 4 (Epic)", accent: "#EF4444" },
  { id: "legendary", rarity: "legendary", title: "Tier 5 (Legendary)", accent: "#EAB308" },
];

const ICON_STYLE_MAP = {
  "Small Heal": { icon: "heart-outline", iconColor: "#16A34A", iconBg: "#DCFCE7" },
  "Double XP": { icon: "star-outline", iconColor: "#0F9F6E", iconBg: "#D1FAE5" },
  "Streak Guard": { icon: "shield-outline", iconColor: "#059669", iconBg: "#D1FAE5" },
  "Boosted Reminder": { icon: "notifications-outline", iconColor: "#10B981", iconBg: "#D1FAE5" },
  "Double Quest Reward": { icon: "calendar-outline", iconColor: "#059669", iconBg: "#D1FAE5" },
  "Quest Skip": { icon: "play-forward-outline", iconColor: "#10B981", iconBg: "#D1FAE5" },
  "Small Reward Chest": { icon: "file-tray-outline", iconColor: "#059669", iconBg: "#D1FAE5" },
  "Medium Heal": { icon: "heart-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Chain Shield": { icon: "shield-half-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Hard Quest EXP Boost": { icon: "trending-up-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Difficulty Reducer": { icon: "arrow-down-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Energy Boost": { icon: "flash-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Medium Reward Chest": { icon: "wallet-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Instant Finish": { icon: "checkmark-done-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" },
  "Large Heal": { icon: "heart-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Advanced Streak Guard": { icon: "shield-checkmark-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Extended Double XP": { icon: "star-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Streak Restore": { icon: "refresh-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Basic Companion": { icon: "paw-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Focus Mode": { icon: "scan-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Large Reward Chest": { icon: "briefcase-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" },
  "Full Restore": { icon: "medkit-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Triple XP": { icon: "sparkles-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Streak Reward Ring": { icon: "sunny-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Challenge Ticket": { icon: "ticket-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Commitment Contract": { icon: "diamond-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Mystery Box": { icon: "gift-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" },
  "Ultra XP x5 (1 Day)": { icon: "rocket-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
  "Instant Level Up": { icon: "trending-up-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
  "Ultimate Streak Shield": { icon: "shield-checkmark-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
  "Triple Quest Reward": { icon: "layers-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
  "Premium Companion": { icon: "paw-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
  "Legendary Chest": { icon: "diamond-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" },
};

function getFallbackIconStyle(itemType, rarity) {
  if (itemType === "cosmetic") {
    return { icon: "paw-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" };
  }

  if (itemType === "material") {
    return { icon: "cube-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" };
  }

  if (itemType === "equipment") {
    return { icon: "shield-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" };
  }

  if (rarity === "legendary") {
    return { icon: "diamond-outline", iconColor: "#CA8A04", iconBg: "#FEF3C7" };
  }

  if (rarity === "epic") {
    return { icon: "sparkles-outline", iconColor: "#EF4444", iconBg: "#FEE2E2" };
  }

  if (rarity === "rare") {
    return { icon: "star-outline", iconColor: "#9333EA", iconBg: "#F3E8FF" };
  }

  return { icon: "bag-handle-outline", iconColor: "#2563EB", iconBg: "#DBEAFE" };
}

function getEffectLabel(item) {
  if (item.effect_type === "hp_restore") {
    return `+${item.effect_value} HP`;
  }

  if (item.effect_type === "exp_multiplier") {
    return `XP x${item.effect_value}`;
  }

  if (item.effect_type === "quest_reward_multiplier") {
    return `Quest x${item.effect_value}`;
  }

  const genericLabels = {
    streak_protect_days: "Protection",
    reminder_boost: "Utility",
    quest_skip: "Special",
    quest_exp_bonus: "Boost",
    difficulty_reduce: "Support",
    energy_restore: "Recovery",
    instant_complete: "Utility",
    streak_restore: "Rare",
    pet_unlock: "Companion",
    focus_mode_unlock: "Utility",
    streak_reward_bonus: "Rare",
    challenge_ticket: "Event",
    commitment_contract: "Special",
    instant_level: "Premium",
    loot_tier: "Chest",
  };

  return genericLabels[item.effect_type] ?? "Item";
}

function normalizeShopItem(listing, item) {
  const style = ICON_STYLE_MAP[item.name] ?? getFallbackIconStyle(item.item_type, item.rarity);

  return {
    id: listing.listing_id,
    itemId: item.item_id,
    name: item.name,
    description: item.description,
    effect: getEffectLabel(item),
    price: Number(listing.price ?? item.base_price ?? 0),
    quantity: Number(listing.quantity ?? 0),
    itemType: item.item_type,
    rarity: item.rarity,
    effectType: item.effect_type,
    effectValue: Number(item.effect_value ?? 0),
    icon: style.icon,
    iconColor: style.iconColor,
    iconBg: style.iconBg,
  };
}

function normalizeInventoryItem(entry, item) {
  const style = ICON_STYLE_MAP[item.name] ?? getFallbackIconStyle(item.item_type, item.rarity);

  return {
    id: entry.inventory_id,
    itemId: item.item_id,
    name: item.name,
    description: item.description,
    quantity: Number(entry.quantity ?? 0),
    equipped: entry.is_equipped === true,
    itemType: item.item_type,
    rarity: item.rarity,
    effectType: item.effect_type,
    effectValue: Number(item.effect_value ?? 0),
    icon: (style.icon ?? "cube-outline").replace("-outline", ""),
    iconColor: style.iconColor,
    iconBg: style.iconBg,
  };
}

async function loadItemsByIds(itemIds = []) {
  if (!itemIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("items")
    .select(
      "item_id, name, description, item_type, rarity, icon_url, base_price, sell_price, effect_type, effect_value, is_tradeable, is_active",
    )
    .in("item_id", itemIds);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((item) => [item.item_id, item]));
}

router.get("/items", requireUser, async (req, res) => {
  try {
    const { data: listings, error: listingsError } = await supabase
      .from("shop_listings")
      .select("listing_id, item_id, price, quantity, listing_type, is_active, expires_at, seller_id")
      .eq("is_active", true)
      .eq("listing_type", "buy")
      .is("seller_id", null)
      .order("price", { ascending: true });

    if (listingsError) {
      throw listingsError;
    }

    const itemsById = await loadItemsByIds((listings ?? []).map((listing) => listing.item_id));
    const sections = STORE_SECTIONS.map((section) => ({ ...section, items: [] }));
    const sectionsByRarity = new Map(sections.map((section) => [section.rarity, section]));

    for (const listing of listings ?? []) {
      const item = itemsById.get(listing.item_id);

      if (!item || item.is_active === false) {
        continue;
      }

      const section = sectionsByRarity.get(item.rarity);

      if (!section) {
        continue;
      }

      section.items.push(normalizeShopItem(listing, item));
    }

    return res.json({
      sections: sections.filter((section) => section.items.length > 0),
    });
  } catch (error) {
    console.error("Store items error:", error);
    return res.status(500).json({ message: "Unable to load store items." });
  }
});

router.get("/inventory", requireUser, async (req, res) => {
  try {
    const { data: inventoryEntries, error: inventoryError } = await supabase
      .from("user_inventory")
      .select("inventory_id, item_id, quantity, is_equipped, obtained_at, obtained_from")
      .eq("user_id", req.userId)
      .order("is_equipped", { ascending: false })
      .order("obtained_at", { ascending: false });

    if (inventoryError) {
      throw inventoryError;
    }

    const itemsById = await loadItemsByIds((inventoryEntries ?? []).map((entry) => entry.item_id));

    const items = (inventoryEntries ?? [])
      .map((entry) => {
        const item = itemsById.get(entry.item_id);

        if (!item || item.is_active === false) {
          return null;
        }

        return normalizeInventoryItem(entry, item);
      })
      .filter(Boolean);

    return res.json({ items });
  } catch (error) {
    console.error("Store inventory error:", error);
    return res.status(500).json({ message: "Unable to load inventory." });
  }
});

module.exports = router;
