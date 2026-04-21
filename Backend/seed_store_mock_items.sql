-- Seed store items and default shop listings from the current frontend mock UI.
--
-- IMPORTANT:
-- Your Supabase project may use different enum values than the placeholders in
-- this file. If you see an error like:
--   invalid input value for enum item_type_enum: "boost"
-- run this inspection query first and update the values below to match:
--
-- select t.typname, e.enumlabel
-- from pg_type t
-- join pg_enum e on e.enumtypid = t.oid
-- where t.typname in ('item_type_enum', 'rarity_enum')
-- order by t.typname, e.enumsortorder;
--
-- This script is idempotent for item names. It updates existing seeded items
-- by name and recreates the default NPC shop listings for those items.

begin;

create temp table tmp_store_seed (
  name text primary key,
  description text not null,
  item_type text not null,
  rarity text not null,
  icon_url text,
  base_price integer not null,
  sell_price integer not null,
  effect_type text,
  effect_value integer not null default 0,
  is_tradeable boolean not null default true
) on commit drop;

insert into tmp_store_seed (
  name,
  description,
  item_type,
  rarity,
  icon_url,
  base_price,
  sell_price,
  effect_type,
  effect_value,
  is_tradeable
)
values
  ('Hồi phục nhỏ', 'Hồi một ít máu.', 'consumable', 'common', 'ion:heart-outline', 10, 5, 'hp_restore', 10, true),
  ('Tăng kinh nghiệm x2', 'Nhân đôi kinh nghiệm trong một lượt thưởng.', 'consumable', 'common', 'ion:star-outline', 20, 10, 'exp_multiplier', 2, true),
  ('Giữ chuỗi', 'Bảo vệ chuỗi hiện tại trong 1 ngày.', 'consumable', 'common', 'ion:shield-outline', 25, 12, 'streak_protect_days', 1, true),
  ('Nhắc nhở tăng cường', 'Thông báo nổi bật cho thói quen quan trọng.', 'consumable', 'common', 'ion:notifications-outline', 15, 7, 'reminder_boost', 1, true),
  ('Phần thưởng nhiệm vụ x2', 'Nhân đôi thưởng nhiệm vụ trong 1 lần dùng.', 'consumable', 'common', 'ion:calendar-outline', 30, 15, 'quest_reward_multiplier', 2, true),
  ('Bỏ qua nhiệm vụ', 'Bỏ qua 1 nhiệm vụ mà không mất tiến độ.', 'consumable', 'uncommon', 'ion:play-forward-outline', 35, 17, 'quest_skip', 1, true),
  ('Rương thưởng nhỏ', 'Mở ra phần thưởng nhỏ ngẫu nhiên.', 'material', 'common', 'ion:file-tray-outline', 20, 10, 'loot_tier', 1, true),

  ('Hồi phục trung', 'Hồi lượng máu vừa.', 'consumable', 'uncommon', 'ion:heart-outline', 40, 20, 'hp_restore', 20, true),
  ('Khiên chuỗi', 'Bảo vệ chuỗi trong thời gian dài hơn.', 'consumable', 'uncommon', 'ion:shield-half-outline', 60, 30, 'streak_protect_days', 2, true),
  ('Tăng EXP theo nhiệm vụ khó', 'Tăng thưởng EXP cho nhiệm vụ khó.', 'consumable', 'uncommon', 'ion:trending-up-outline', 50, 25, 'quest_exp_bonus', 50, true),
  ('Giảm độ khó', 'Giảm yêu cầu hoàn thành cho 1 nhiệm vụ.', 'consumable', 'uncommon', 'ion:arrow-down-outline', 55, 27, 'difficulty_reduce', 1, true),
  ('Tăng năng lượng', 'Hồi phục thêm năng lượng cho nhân vật.', 'consumable', 'uncommon', 'ion:flash-outline', 60, 30, 'energy_restore', 20, true),
  ('Rương thưởng trung', 'Mở ra phần thưởng cỡ vừa.', 'material', 'uncommon', 'ion:wallet-outline', 45, 22, 'loot_tier', 2, true),
  ('Hoàn thành nhanh', 'Hoàn tất ngay một nhiệm vụ đơn giản.', 'consumable', 'uncommon', 'ion:checkmark-done-outline', 70, 35, 'instant_complete', 1, true),

  ('Hồi phục lớn', 'Hồi lượng máu lớn.', 'consumable', 'rare', 'ion:heart-outline', 80, 40, 'hp_restore', 40, true),
  ('Giữ chuỗi nâng cao', 'Bảo vệ chuỗi trong 2 ngày.', 'consumable', 'rare', 'ion:shield-checkmark-outline', 90, 45, 'streak_protect_days', 2, true),
  ('Tăng EXP x2', 'Nhân đôi kinh nghiệm trong thời gian lâu hơn.', 'consumable', 'rare', 'ion:star-outline', 100, 50, 'exp_multiplier', 2, true),
  ('Quay lại chuỗi', 'Khôi phục chuỗi vừa bị mất.', 'consumable', 'rare', 'ion:refresh-outline', 110, 55, 'streak_restore', 1, true),
  ('Thú đồng hành sơ bản', 'Mở khóa thú đồng hành cơ bản.', 'cosmetic', 'rare', 'ion:paw-outline', 95, 47, 'pet_unlock', 1, true),
  ('Chế độ tập trung', 'Kích hoạt chế độ tập trung cao.', 'consumable', 'rare', 'ion:scan-outline', 85, 42, 'focus_mode_unlock', 1, true),
  ('Rương thưởng lớn', 'Mở ra phần thưởng lớn.', 'material', 'rare', 'ion:briefcase-outline', 90, 45, 'loot_tier', 3, true),

  ('Hồi phục toàn phần', 'Hồi đầy máu ngay lập tức.', 'consumable', 'epic', 'ion:medkit-outline', 130, 65, 'hp_restore', 100, true),
  ('Tăng EXP x3', 'Nhân ba kinh nghiệm.', 'consumable', 'epic', 'ion:sparkles-outline', 140, 70, 'exp_multiplier', 3, true),
  ('Nhẫn thưởng chuỗi', 'Tăng thưởng nhận được từ chuỗi.', 'equipment', 'epic', 'ion:sunny-outline', 150, 75, 'streak_reward_bonus', 1, true),
  ('Vé thử thách', 'Tham gia thử thách đặc biệt.', 'consumable', 'epic', 'ion:ticket-outline', 120, 60, 'challenge_ticket', 1, true),
  ('Hợp đồng cam kết', 'Cam kết để nhận thưởng lớn hơn.', 'consumable', 'epic', 'ion:diamond-outline', 138, 69, 'commitment_contract', 1, true),
  ('Hộp may rủi', 'Mở ra vật phẩm ngẫu nhiên.', 'material', 'epic', 'ion:gift-outline', 125, 62, 'loot_tier', 4, true),

  ('Tăng EXP x5 (1 ngày)', 'Buff cực mạnh trong 1 ngày, đi kèm rủi ro cao.', 'consumable', 'legendary', 'ion:rocket-outline', 180, 90, 'exp_multiplier', 5, true),
  ('Lên cấp ngay', 'Tăng ngay 1 level cho nhân vật.', 'consumable', 'legendary', 'ion:trending-up-outline', 200, 100, 'instant_level', 1, true),
  ('Siêu khiên chuỗi', 'Bảo vệ streak trong 7 ngày.', 'consumable', 'legendary', 'ion:shield-checkmark-outline', 170, 85, 'streak_protect_days', 7, true),
  ('Nhân 3 phần thưởng nhiệm vụ', 'Nhân 3 phần thưởng nhiệm vụ cho 1 task.', 'consumable', 'legendary', 'ion:layers-outline', 160, 80, 'quest_reward_multiplier', 3, true),
  ('Thú đồng hành cao cấp', 'Thú đồng hành có bonus đặc biệt.', 'cosmetic', 'legendary', 'ion:paw-outline', 175, 87, 'pet_unlock', 2, true),
  ('Rương huyền thoại', 'Rương phần thưởng cực hiếm.', 'material', 'legendary', 'ion:diamond-outline', 190, 95, 'loot_tier', 5, true);

do $$
declare
  allowed_item_types text;
  allowed_rarities text;
  invalid_item_types text;
  invalid_rarities text;
begin
  select string_agg(enumlabel, ', ' order by enumsortorder)
  into allowed_item_types
  from pg_enum
  where enumtypid = 'public.item_type_enum'::regtype;

  select string_agg(enumlabel, ', ' order by enumsortorder)
  into allowed_rarities
  from pg_enum
  where enumtypid = 'public.rarity_enum'::regtype;

  select string_agg(distinct seed.item_type, ', ' order by seed.item_type)
  into invalid_item_types
  from tmp_store_seed seed
  where not exists (
    select 1
    from pg_enum enum_value
    where enum_value.enumtypid = 'public.item_type_enum'::regtype
      and enum_value.enumlabel = seed.item_type
  );

  if invalid_item_types is not null then
    raise exception
      'Invalid item_type values in seed: %. Allowed item_type_enum values are: %',
      invalid_item_types,
      coalesce(allowed_item_types, '(none found)');
  end if;

  select string_agg(distinct seed.rarity, ', ' order by seed.rarity)
  into invalid_rarities
  from tmp_store_seed seed
  where not exists (
    select 1
    from pg_enum enum_value
    where enum_value.enumtypid = 'public.rarity_enum'::regtype
      and enum_value.enumlabel = seed.rarity
  );

  if invalid_rarities is not null then
    raise exception
      'Invalid rarity values in seed: %. Allowed rarity_enum values are: %',
      invalid_rarities,
      coalesce(allowed_rarities, '(none found)');
  end if;
end $$;

insert into public.items (
  name,
  description,
  item_type,
  rarity,
  icon_url,
  base_price,
  sell_price,
  effect_type,
  effect_value,
  is_tradeable,
  is_active
)
select
  seed.name,
  seed.description,
  seed.item_type::public.item_type_enum,
  seed.rarity::public.rarity_enum,
  seed.icon_url,
  seed.base_price,
  seed.sell_price,
  seed.effect_type,
  seed.effect_value,
  seed.is_tradeable,
  true
from tmp_store_seed seed
on conflict (name) do update
set
  description = excluded.description,
  item_type = excluded.item_type,
  rarity = excluded.rarity,
  icon_url = excluded.icon_url,
  base_price = excluded.base_price,
  sell_price = excluded.sell_price,
  effect_type = excluded.effect_type,
  effect_value = excluded.effect_value,
  is_tradeable = excluded.is_tradeable,
  is_active = true;

delete from public.shop_listings
where seller_id is null
  and item_id in (
    select item_id
    from public.items
    where name in (select name from tmp_store_seed)
  );

insert into public.shop_listings (
  item_id,
  seller_id,
  price,
  quantity,
  listing_type,
  is_active,
  expires_at
)
select
  items.item_id,
  null,
  items.base_price,
  999,
  'buy',
  true,
  null
from public.items items
join tmp_store_seed seed on seed.name = items.name;

commit;

-- Optional template: seed starter inventory for one specific user.
-- Replace the UUID and item names as needed before running.
--
-- insert into public.user_inventory (user_id, item_id, quantity, is_equipped, obtained_from)
-- select
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   item_id,
--   1,
--   false,
--   'store_seed'
-- from public.items
-- where name in ('Hồi phục nhỏ', 'Tăng kinh nghiệm x2');
