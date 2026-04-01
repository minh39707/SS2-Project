-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
  achievement_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id uuid,
  title character varying NOT NULL,
  description text NOT NULL,
  icon_url text,
  rarity USER-DEFINED NOT NULL DEFAULT 'common'::rarity_enum,
  requirement_type character varying NOT NULL,
  requirement_value integer NOT NULL,
  exp_reward integer NOT NULL DEFAULT 25,
  gold_reward integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (achievement_id),
  CONSTRAINT achievements_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.habit_categories(category_id)
);
CREATE TABLE public.ai_conversations (
  conversation_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  session_type USER-DEFINED NOT NULL DEFAULT 'checkin'::ai_session_type_enum,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  message_count integer NOT NULL DEFAULT 0,
  CONSTRAINT ai_conversations_pkey PRIMARY KEY (conversation_id),
  CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.ai_messages (
  message_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  content text NOT NULL,
  intent character varying,
  parsed_habits jsonb,
  gemini_response_id character varying,
  tokens_used integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(conversation_id),
  CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.ai_side_quests (
  ai_quest_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  quest_id uuid NOT NULL,
  generation_prompt text,
  gemini_model character varying,
  behavior_snapshot jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  week_start date NOT NULL,
  CONSTRAINT ai_side_quests_pkey PRIMARY KEY (ai_quest_id),
  CONSTRAINT ai_side_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT ai_side_quests_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quests(quest_id)
);
CREATE TABLE public.analytics_daily (
  analytics_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  habits_completed integer NOT NULL DEFAULT 0,
  habits_missed integer NOT NULL DEFAULT 0,
  total_exp_gained integer NOT NULL DEFAULT 0,
  total_hp_change integer NOT NULL DEFAULT 0,
  active_streaks integer NOT NULL DEFAULT 0,
  items_dropped integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  completion_rate numeric NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_pkey PRIMARY KEY (analytics_id),
  CONSTRAINT analytics_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.characters (
  character_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  name character varying NOT NULL,
  class character varying NOT NULL DEFAULT 'Novice'::character varying,
  avatar_url text,
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  current_hp integer NOT NULL DEFAULT 100 CHECK (current_hp >= 0),
  max_hp integer NOT NULL DEFAULT 100 CHECK (max_hp > 0),
  current_exp integer NOT NULL DEFAULT 0 CHECK (current_exp >= 0),
  exp_to_next_level integer NOT NULL DEFAULT 100 CHECK (exp_to_next_level > 0),
  power integer NOT NULL DEFAULT 10 CHECK (power >= 0),
  drop_rate_bonus numeric NOT NULL DEFAULT 0.00,
  gold_coins integer NOT NULL DEFAULT 0 CHECK (gold_coins >= 0),
  total_coins_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT characters_pkey PRIMARY KEY (character_id),
  CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.friendships (
  friendship_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id_1 uuid NOT NULL,
  user_id_2 uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::friendship_status_enum,
  requested_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT friendships_pkey PRIMARY KEY (friendship_id),
  CONSTRAINT friendships_user_id_1_fkey FOREIGN KEY (user_id_1) REFERENCES public.users(user_id),
  CONSTRAINT friendships_user_id_2_fkey FOREIGN KEY (user_id_2) REFERENCES public.users(user_id),
  CONSTRAINT friendships_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.habit_categories (
  category_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  icon_url text,
  color_hex character varying,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habit_categories_pkey PRIMARY KEY (category_id)
);
CREATE TABLE public.habit_logs (
  log_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  habit_id uuid NOT NULL,
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  status USER-DEFINED NOT NULL,
  value_recorded numeric,
  hp_change integer NOT NULL DEFAULT 0,
  exp_change integer NOT NULL DEFAULT 0,
  streak_at_log integer NOT NULL DEFAULT 0,
  source USER-DEFINED NOT NULL DEFAULT 'manual'::log_source_enum,
  ai_message_id uuid,
  notes text,
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habit_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT habit_logs_ai_message_id_fkey FOREIGN KEY (ai_message_id) REFERENCES public.ai_messages(message_id),
  CONSTRAINT habit_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(habit_id),
  CONSTRAINT habit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.habit_streaks (
  streak_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  habit_id uuid NOT NULL,
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak integer NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_completed_at date,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habit_streaks_pkey PRIMARY KEY (streak_id),
  CONSTRAINT habit_streaks_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(habit_id),
  CONSTRAINT habit_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.habits (
  habit_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  category_id uuid,
  title character varying NOT NULL,
  description text,
  habit_type USER-DEFINED NOT NULL,
  tracking_method USER-DEFINED NOT NULL,
  target_value numeric,
  target_unit character varying,
  frequency_type USER-DEFINED NOT NULL DEFAULT 'daily'::frequency_type_enum,
  frequency_days ARRAY,
  hp_reward integer NOT NULL DEFAULT 10,
  exp_reward integer NOT NULL DEFAULT 20,
  hp_penalty integer NOT NULL DEFAULT 15,
  streak_bonus_exp integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  ai_categorized boolean NOT NULL DEFAULT false,
  ai_tags ARRAY,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habits_pkey PRIMARY KEY (habit_id),
  CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT habits_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.habit_categories(category_id)
);
CREATE TABLE public.items (
  item_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  description text,
  item_type USER-DEFINED NOT NULL,
  rarity USER-DEFINED NOT NULL DEFAULT 'common'::rarity_enum,
  icon_url text,
  base_price integer NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  sell_price integer NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  effect_type character varying,
  effect_value integer NOT NULL DEFAULT 0,
  is_tradeable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT items_pkey PRIMARY KEY (item_id)
);
CREATE TABLE public.leaderboard_snapshots (
  snapshot_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  period_type USER-DEFINED NOT NULL,
  period_start date NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  score integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  habits_completed integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_snapshots_pkey PRIMARY KEY (snapshot_id),
  CONSTRAINT leaderboard_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.notifications (
  notification_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title character varying NOT NULL,
  body text NOT NULL,
  payload jsonb,
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.oauth_providers (
  oauth_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  provider USER-DEFINED NOT NULL,
  provider_user_id character varying NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT oauth_providers_pkey PRIMARY KEY (oauth_id),
  CONSTRAINT oauth_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.quest_steps (
  step_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  quest_id uuid NOT NULL,
  step_order integer NOT NULL,
  title character varying NOT NULL,
  description text,
  action_type character varying,
  action_payload jsonb,
  exp_reward integer NOT NULL DEFAULT 0,
  CONSTRAINT quest_steps_pkey PRIMARY KEY (step_id),
  CONSTRAINT quest_steps_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quests(quest_id)
);
CREATE TABLE public.quests (
  quest_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title character varying NOT NULL,
  description text NOT NULL,
  quest_type USER-DEFINED NOT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  difficulty USER-DEFINED NOT NULL DEFAULT 'normal'::quest_difficulty_enum,
  exp_reward integer NOT NULL DEFAULT 50,
  gold_reward integer NOT NULL DEFAULT 0,
  item_reward_id uuid,
  duration_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quests_pkey PRIMARY KEY (quest_id),
  CONSTRAINT quests_item_reward_id_fkey FOREIGN KEY (item_reward_id) REFERENCES public.items(item_id)
);
CREATE TABLE public.scheduled_jobs (
  job_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_type USER-DEFINED NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::job_status_enum,
  affected_users integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (job_id)
);
CREATE TABLE public.shop_listings (
  listing_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL,
  seller_id uuid,
  price integer NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  listing_type character varying NOT NULL DEFAULT 'buy'::character varying CHECK (listing_type::text = ANY (ARRAY['buy'::character varying, 'sell'::character varying, 'both'::character varying]::text[])),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_listings_pkey PRIMARY KEY (listing_id),
  CONSTRAINT shop_listings_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT shop_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.transactions (
  transaction_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  listing_id uuid,
  transaction_type USER-DEFINED NOT NULL,
  item_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT transactions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.shop_listings(listing_id),
  CONSTRAINT transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE TABLE public.user_achievements (
  user_achievement_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  is_notified boolean NOT NULL DEFAULT false,
  CONSTRAINT user_achievements_pkey PRIMARY KEY (user_achievement_id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(achievement_id)
);
CREATE TABLE public.user_inventory (
  inventory_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_equipped boolean NOT NULL DEFAULT false,
  obtained_at timestamp with time zone NOT NULL DEFAULT now(),
  obtained_from character varying,
  CONSTRAINT user_inventory_pkey PRIMARY KEY (inventory_id),
  CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE TABLE public.user_quests (
  user_quest_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  quest_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'active'::user_quest_status_enum,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target integer NOT NULL CHECK (target > 0),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  CONSTRAINT user_quests_pkey PRIMARY KEY (user_quest_id),
  CONSTRAINT user_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_quests_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.quests(quest_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  username character varying NOT NULL UNIQUE,
  password_hash character varying,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_email_verified boolean NOT NULL DEFAULT false,
  timezone character varying NOT NULL DEFAULT 'UTC'::character varying,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);