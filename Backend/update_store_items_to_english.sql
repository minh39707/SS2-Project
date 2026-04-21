-- Update existing seeded store item names and descriptions to English.
-- Run this after your original seed has already been inserted.
-- This script updates rows in place, so existing item_ids, listings,
-- inventory references, and transactions remain intact.

begin;

create temp table tmp_store_translation (
  old_name text primary key,
  new_name text not null,
  new_description text not null
) on commit drop;

insert into tmp_store_translation (old_name, new_name, new_description)
values
  ('Hồi phục nhỏ', 'Small Heal', 'Restore a small amount of HP.'),
  ('Tăng kinh nghiệm x2', 'Double XP', 'Double your XP reward once.'),
  ('Giữ chuỗi', 'Streak Guard', 'Protect your current streak for 1 day.'),
  ('Nhắc nhở tăng cường', 'Boosted Reminder', 'Highlight notifications for important habits.'),
  ('Phần thưởng nhiệm vụ x2', 'Double Quest Reward', 'Double your quest reward for one use.'),
  ('Bỏ qua nhiệm vụ', 'Quest Skip', 'Skip one quest without losing progress.'),
  ('Rương thưởng nhỏ', 'Small Reward Chest', 'Open a random small reward chest.'),

  ('Hồi phục trung', 'Medium Heal', 'Restore a medium amount of HP.'),
  ('Khiên chuỗi', 'Chain Shield', 'Protect your streak for a longer time.'),
  ('Tăng EXP theo nhiệm vụ khó', 'Hard Quest EXP Boost', 'Increase XP rewards for difficult quests.'),
  ('Giảm độ khó', 'Difficulty Reducer', 'Reduce the completion requirement for one quest.'),
  ('Tăng năng lượng', 'Energy Boost', 'Restore extra energy for your character.'),
  ('Rương thưởng trung', 'Medium Reward Chest', 'Open a medium reward chest.'),
  ('Hoàn thành nhanh', 'Instant Finish', 'Instantly finish one simple quest.'),

  ('Hồi phục lớn', 'Large Heal', 'Restore a large amount of HP.'),
  ('Giữ chuỗi nâng cao', 'Advanced Streak Guard', 'Protect your streak for 2 days.'),
  ('Tăng EXP x2', 'Extended Double XP', 'Double your XP for a longer duration.'),
  ('Quay lại chuỗi', 'Streak Restore', 'Restore a streak that was just lost.'),
  ('Thú đồng hành sơ bản', 'Basic Companion', 'Unlock a basic companion.'),
  ('Chế độ tập trung', 'Focus Mode', 'Unlock an enhanced focus mode.'),
  ('Rương thưởng lớn', 'Large Reward Chest', 'Open a large reward chest.'),

  ('Hồi phục toàn phần', 'Full Restore', 'Completely restore HP instantly.'),
  ('Tăng EXP x3', 'Triple XP', 'Triple your XP gain.'),
  ('Nhẫn thưởng chuỗi', 'Streak Reward Ring', 'Increase the rewards you gain from streaks.'),
  ('Vé thử thách', 'Challenge Ticket', 'Join a special challenge.'),
  ('Hợp đồng cam kết', 'Commitment Contract', 'Commit for a larger reward.'),
  ('Hộp may rủi', 'Mystery Box', 'Open a random item box.'),

  ('Tăng EXP x5 (1 ngày)', 'Ultra XP x5 (1 Day)', 'A powerful 1-day XP boost with high risk.'),
  ('Lên cấp ngay', 'Instant Level Up', 'Instantly gain 1 level.'),
  ('Siêu khiên chuỗi', 'Ultimate Streak Shield', 'Protect your streak for 7 days.'),
  ('Nhân 3 phần thưởng nhiệm vụ', 'Triple Quest Reward', 'Triple the reward for one quest.'),
  ('Thú đồng hành cao cấp', 'Premium Companion', 'A premium companion with a special bonus.'),
  ('Rương huyền thoại', 'Legendary Chest', 'An extremely rare reward chest.');

update public.items as items
set
  name = translation.new_name,
  description = translation.new_description
from tmp_store_translation as translation
where items.name = translation.old_name;

commit;

-- Optional verification:
-- select name, description, rarity, base_price
-- from public.items
-- order by rarity, base_price, name;
