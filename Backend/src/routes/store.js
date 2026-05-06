const express = require("express");
const { supabase } = require("../supabase");
const { requireUser } = require("../middleware/auth");
const { applyCharacterProgress } = require("../utils/habitProgress");

const router = express.Router();

const STORE_SECTIONS = [
  { id: "common", rarity: "common", title: "Tier 1", accent: "#18B981" },
  { id: "uncommon", rarity: "uncommon", title: "Tier 2", accent: "#3B82F6" },
  { id: "rare", rarity: "rare", title: "Tier 3", accent: "#A855F7" },
  { id: "epic", rarity: "epic", title: "Tier 4 (Epic)", accent: "#EF4444" },
  { id: "legendary", rarity: "legendary", title: "Tier 5 (Legendary)", accent: "#EAB308" },
];

const IMMEDIATE_EFFECT_TYPES = new Set([
  "hp_restore",
  "energy_restore",
  "exp_grant",
  "exp_multiplier",
  "quest_exp_bonus",
  "hard_quest_exp_boost",
  "instant_level",
  "loot_tier",
]);
const EQUIPPABLE_ITEM_TYPES = new Set(["cosmetic", "equipment"]);
const EQUIPPABLE_EFFECT_TYPES = new Set(["pet_unlock", "focus_mode_unlock"]);

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
  const value = Number(item.effect_value ?? 0);
  const labels = {
    hp_restore: `+${value} HP`,
    energy_restore: `+${value} HP`,
    exp_grant: `+${value} EXP`,
    exp_multiplier: `+${value * 30} EXP`,
    quest_reward_multiplier: `Quest x${value}`,
    streak_protect_days: `${value || 1} shield`,
    reminder_boost: "Reminder",
    quest_skip: "Quest skip",
    quest_exp_bonus: `+${value * 25} EXP`,
    hard_quest_exp_boost: `+${value * 25} EXP`,
    difficulty_reduce: "Quest aid",
    instant_complete: "Habit aid",
    streak_restore: "Restore",
    pet_unlock: "Companion",
    focus_mode_unlock: "Focus",
    streak_reward_bonus: "Streak bonus",
    challenge_ticket: "Challenge",
    commitment_contract: "Contract",
    instant_level: "Level up",
    loot_tier: "Chest",
  };

  return labels[item.effect_type] ?? "Passive";
}

function getItemCapabilities(item) {
  const canEquip =
    EQUIPPABLE_ITEM_TYPES.has(item.item_type) ||
    EQUIPPABLE_EFFECT_TYPES.has(item.effect_type);
  const canUse = IMMEDIATE_EFFECT_TYPES.has(item.effect_type) && !canEquip;

  return {
    canUse,
    canEquip,
    primaryAction: canEquip ? "equip" : canUse ? "use" : "passive",
  };
}

function normalizeShopItem(listing, item) {
  const style = ICON_STYLE_MAP[item.name] ?? getFallbackIconStyle(item.item_type, item.rarity);
  const capabilities = getItemCapabilities(item);

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
    effectLabel: getEffectLabel(item),
    ...capabilities,
    icon: style.icon,
    iconColor: style.iconColor,
    iconBg: style.iconBg,
  };
}

function normalizeInventoryItem(entry, item) {
  const style = ICON_STYLE_MAP[item.name] ?? getFallbackIconStyle(item.item_type, item.rarity);
  const capabilities = getItemCapabilities(item);

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
    effectLabel: getEffectLabel(item),
    ...capabilities,
    isTradeable: item.is_tradeable === true,
    sellPrice: Number(item.sell_price ?? Math.floor((item.base_price ?? 0) * 0.5)),
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

router.post("/buy", requireUser, async (req, res) => {
  try {
    const { listing_id } = req.body;

    if (!listing_id) {
      return res.status(400).json({ message: "listing_id is required." });
    }

    const { data: listing, error: listingError } = await supabase
      .from("shop_listings")
      .select("listing_id, item_id, price, is_active, listing_type, seller_id")
      .eq("listing_id", listing_id)
      .eq("is_active", true)
      .eq("listing_type", "buy")
      .is("seller_id", null)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ message: "Item not found in store." });
    }

    const itemsMap = await loadItemsByIds([listing.item_id]);
    const item = itemsMap.get(listing.item_id);

    if (!item || item.is_active === false) {
      return res.status(404).json({ message: "Item is no longer available." });
    }

    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("character_id, gold_coins")
      .eq("user_id", req.userId)
      .single();

    if (charError || !character) {
      return res.status(404).json({ message: "Character not found." });
    }

    const price = Number(listing.price);

    if (character.gold_coins < price) {
      return res.status(400).json({ message: "Not enough gold." });
    }

    const newGold = character.gold_coins - price;

    const { error: goldError } = await supabase
      .from("characters")
      .update({ gold_coins: newGold })
      .eq("user_id", req.userId);

    if (goldError) {
      throw goldError;
    }

    const { data: existing } = await supabase
      .from("user_inventory")
      .select("inventory_id, quantity")
      .eq("user_id", req.userId)
      .eq("item_id", listing.item_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_inventory")
        .update({ quantity: existing.quantity + 1 })
        .eq("inventory_id", existing.inventory_id);
    } else {
      await supabase.from("user_inventory").insert({
        user_id: req.userId,
        item_id: listing.item_id,
        quantity: 1,
        is_equipped: false,
        obtained_from: "shop",
      });
    }

    return res.json({ success: true, gold_coins: newGold, item_name: item.name });
  } catch (error) {
    console.error("Buy error:", error);
    return res.status(500).json({ message: "Purchase failed." });
  }
});

router.post("/use/:inventory_id", requireUser, async (req, res) => {
  try {
    const { inventory_id } = req.params;

    const { data: entry, error: invError } = await supabase
      .from("user_inventory")
      .select("inventory_id, item_id, quantity, is_equipped")
      .eq("inventory_id", inventory_id)
      .eq("user_id", req.userId)
      .single();

    if (invError || !entry || entry.quantity < 1) {
      return res.status(404).json({ message: "Item not found in inventory." });
    }

    const itemsMap = await loadItemsByIds([entry.item_id]);
    const item = itemsMap.get(entry.item_id);

    if (!item) {
      return res.status(404).json({ message: "Item data not found." });
    }

    const capabilities = getItemCapabilities(item);

    if (!capabilities.canUse) {
      return res.status(400).json({
        message:
          capabilities.canEquip
            ? "Equip this item from your inventory instead of using it."
            : "This item is passive and cannot be used yet.",
      });
    }

    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("character_id, level, current_hp, max_hp, current_exp, exp_to_next_level, gold_coins")
      .eq("user_id", req.userId)
      .single();

    if (charError || !character) {
      return res.status(404).json({ message: "Character not found." });
    }

    let expChange = 0;
    let hpChange = 0;
    let goldChange = 0;
    let effectMessage = `${item.name} activated!`;
    const effectValue = Number(item.effect_value ?? 0);

    switch (item.effect_type) {
      case "hp_restore":
      case "energy_restore": {
        const actualHeal = Math.min(effectValue, character.max_hp - character.current_hp);
        hpChange = effectValue;
        effectMessage = `Restored ${actualHeal} HP.`;
        break;
      }
      case "exp_grant": {
        expChange = effectValue;
        effectMessage = `Gained ${expChange} EXP.`;
        break;
      }
      case "exp_multiplier": {
        expChange = Math.round(effectValue * 30);
        effectMessage = `Gained ${expChange} EXP.`;
        break;
      }
      case "quest_exp_bonus":
      case "hard_quest_exp_boost": {
        expChange = Math.round(effectValue * 25);
        effectMessage = `Gained ${expChange} EXP bonus.`;
        break;
      }
      case "instant_level": {
        expChange = Math.max(0, character.exp_to_next_level - character.current_exp);
        effectMessage = "Gained enough EXP to level up!";
        break;
      }
      case "loot_tier": {
        goldChange = Math.round(effectValue * 15 + Math.random() * effectValue * 10);
        expChange = Math.round(effectValue * 10);
        effectMessage = `Opened chest! Got ${goldChange} gold and ${expChange} EXP.`;
        break;
      }
      default:
        effectMessage = `${item.name} effect applied!`;
        break;
    }

    const updates = applyCharacterProgress(character, expChange, hpChange, goldChange);

    const { error: updateError } = await supabase
      .from("characters")
      .update(updates)
      .eq("user_id", req.userId);

    if (updateError) {
      throw updateError;
    }

    if (entry.quantity <= 1) {
      await supabase.from("user_inventory").delete().eq("inventory_id", inventory_id);
    } else {
      await supabase
        .from("user_inventory")
        .update({ quantity: entry.quantity - 1 })
        .eq("inventory_id", inventory_id);
    }

    return res.json({
      success: true,
      message: effectMessage,
      character: { ...character, ...updates },
    });
  } catch (error) {
    console.error("Use item error:", error);
    return res.status(500).json({ message: "Failed to use item." });
  }
});

router.post("/sell/:inventory_id", requireUser, async (req, res) => {
  try {
    const { inventory_id } = req.params;

    const { data: entry, error: invError } = await supabase
      .from("user_inventory")
      .select("inventory_id, item_id, quantity")
      .eq("inventory_id", inventory_id)
      .eq("user_id", req.userId)
      .single();

    if (invError || !entry) {
      return res.status(404).json({ message: "Item not found in inventory." });
    }

    const itemsMap = await loadItemsByIds([entry.item_id]);
    const item = itemsMap.get(entry.item_id);

    if (!item) {
      return res.status(404).json({ message: "Item data not found." });
    }

    if (!item.is_tradeable) {
      return res.status(400).json({ message: "This item cannot be sold." });
    }

    const sellPrice = Number(item.sell_price ?? Math.floor((item.base_price ?? 0) * 0.5));

    const { data: character, error: charError } = await supabase
      .from("characters")
      .select("character_id, gold_coins")
      .eq("user_id", req.userId)
      .single();

    if (charError || !character) {
      return res.status(404).json({ message: "Character not found." });
    }

    const newGold = character.gold_coins + sellPrice;

    await supabase
      .from("characters")
      .update({ gold_coins: newGold })
      .eq("user_id", req.userId);

    if (entry.quantity <= 1) {
      await supabase.from("user_inventory").delete().eq("inventory_id", inventory_id);
    } else {
      await supabase
        .from("user_inventory")
        .update({ quantity: entry.quantity - 1 })
        .eq("inventory_id", inventory_id);
    }

    return res.json({ success: true, gold_coins: newGold, gold_earned: sellPrice });
  } catch (error) {
    console.error("Sell item error:", error);
    return res.status(500).json({ message: "Failed to sell item." });
  }
});

router.post("/equip/:inventory_id", requireUser, async (req, res) => {
  try {
    const { inventory_id } = req.params;
    const { equip } = req.body;

    const { data: entry, error: invError } = await supabase
      .from("user_inventory")
      .select("inventory_id, item_id")
      .eq("inventory_id", inventory_id)
      .eq("user_id", req.userId)
      .single();

    if (invError || !entry) {
      return res.status(404).json({ message: "Item not found in inventory." });
    }

    const itemsMap = await loadItemsByIds([entry.item_id]);
    const item = itemsMap.get(entry.item_id);

    if (!item) {
      return res.status(404).json({ message: "Item data not found." });
    }

    if (!getItemCapabilities(item).canEquip) {
      return res.status(400).json({ message: "This item cannot be equipped." });
    }

    const isEquipped = equip === true;

    await supabase
      .from("user_inventory")
      .update({ is_equipped: isEquipped })
      .eq("inventory_id", inventory_id);

    return res.json({ success: true, is_equipped: isEquipped });
  } catch (error) {
    console.error("Equip item error:", error);
    return res.status(500).json({ message: "Failed to equip item." });
  }
});

module.exports = router;
