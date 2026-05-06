-- Quests system compatibility migration for the existing public.quests schema.
-- Current database uses quest_id/user_quest_id, quest_type enum, target, and started_at.

ALTER TABLE quests ADD COLUMN IF NOT EXISTS hp_reward INT NOT NULL DEFAULT 0;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS target_count INT NOT NULL DEFAULT 1;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'flag-outline';

ALTER TABLE user_quests ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0;
ALTER TABLE user_quests ADD COLUMN IF NOT EXISTS target INT NOT NULL DEFAULT 1;
ALTER TABLE user_quests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_quests_user_id_status_idx ON user_quests (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS quests_title_key ON quests (title);

-- Starter quest catalogue. quest_type is required in the existing schema, so pick
-- the first valid enum label dynamically instead of guessing enum values.
DO $$
DECLARE
  quest_type_exists BOOLEAN := false;
  quest_type_value TEXT := 'system';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quests'
      AND column_name = 'quest_type'
  )
  INTO quest_type_exists;

  IF quest_type_exists THEN
    SELECT e.enumlabel
    INTO quest_type_value
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE c.table_schema = 'public'
      AND c.table_name = 'quests'
      AND c.column_name = 'quest_type'
    ORDER BY e.enumsortorder
    LIMIT 1;

    quest_type_value := COALESCE(quest_type_value, 'system');
    EXECUTE format('ALTER TABLE quests ALTER COLUMN quest_type SET DEFAULT %L', quest_type_value);

    EXECUTE format(
      $seed$
        INSERT INTO quests (
          title,
          description,
          quest_type,
          exp_reward,
          gold_reward,
          hp_reward,
          target_count,
          icon
        ) VALUES
          ('First Steps',        'Complete any habit 3 times',             %L,  50,  10, 0,  3, 'footsteps-outline'),
          ('Morning Warrior',    'Complete a morning habit 5 times',       %L,  80,  15, 0,  5, 'sunny-outline'),
          ('Daily Grind',        'Complete all your habits in one day',     %L,  60,  12, 0,  1, 'checkmark-circle-outline'),
          ('Health Seeker',      'Complete a health-related habit 5 times', %L,  80,  15, 0,  5, 'heart-outline'),
          ('Streak Starter',     'Keep a 3-day habit streak',              %L,  70,  14, 0,  3, 'flame-outline'),
          ('Consistency',        'Complete any habit 10 times total',       %L, 150,  30, 0, 10, 'repeat-outline'),
          ('Streak Master',      'Maintain a 7-day streak',                %L, 200,  40, 0,  7, 'shield-outline'),
          ('Week Champion',      'Complete 5 habits in one week',          %L, 180,  35, 0,  5, 'star-outline'),
          ('Iron Will',          'Complete habits 10 days in a row',        %L, 350,  70, 0, 10, 'barbell-outline'),
          ('Consistency King',   'Complete any habit 20 times total',       %L, 400,  80, 0, 20, 'trophy-outline'),
          ('Legendary Streak',   'Maintain a 30-day streak',               %L, 600, 120, 0, 30, 'ribbon-outline')
        ON CONFLICT (title) DO UPDATE SET
          description = EXCLUDED.description,
          exp_reward = EXCLUDED.exp_reward,
          gold_reward = EXCLUDED.gold_reward,
          hp_reward = EXCLUDED.hp_reward,
          target_count = EXCLUDED.target_count,
          icon = EXCLUDED.icon;
      $seed$,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value,
      quest_type_value
    );
  ELSE
    INSERT INTO quests (
      title,
      description,
      exp_reward,
      gold_reward,
      hp_reward,
      target_count,
      icon
    ) VALUES
      ('First Steps',        'Complete any habit 3 times',              50,  10, 0,  3, 'footsteps-outline'),
      ('Morning Warrior',    'Complete a morning habit 5 times',        80,  15, 0,  5, 'sunny-outline'),
      ('Daily Grind',        'Complete all your habits in one day',      60,  12, 0,  1, 'checkmark-circle-outline'),
      ('Health Seeker',      'Complete a health-related habit 5 times',  80,  15, 0,  5, 'heart-outline'),
      ('Streak Starter',     'Keep a 3-day habit streak',               70,  14, 0,  3, 'flame-outline'),
      ('Consistency',        'Complete any habit 10 times total',       150,  30, 0, 10, 'repeat-outline'),
      ('Streak Master',      'Maintain a 7-day streak',                200,  40, 0,  7, 'shield-outline'),
      ('Week Champion',      'Complete 5 habits in one week',          180,  35, 0,  5, 'star-outline'),
      ('Iron Will',          'Complete habits 10 days in a row',        350,  70, 0, 10, 'barbell-outline'),
      ('Consistency King',   'Complete any habit 20 times total',       400,  80, 0, 20, 'trophy-outline'),
      ('Legendary Streak',   'Maintain a 30-day streak',                600, 120, 0, 30, 'ribbon-outline')
    ON CONFLICT (title) DO UPDATE SET
      description = EXCLUDED.description,
      exp_reward = EXCLUDED.exp_reward,
      gold_reward = EXCLUDED.gold_reward,
      hp_reward = EXCLUDED.hp_reward,
      target_count = EXCLUDED.target_count,
      icon = EXCLUDED.icon;
  END IF;
END $$;
