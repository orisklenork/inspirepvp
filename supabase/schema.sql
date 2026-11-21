-- InspiredPVP — Supabase PostgreSQL Schema, RLS Policies, Triggers & Avatar Storage
-- Run this file in your Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Username Registry (maps unique case-insensitive usernames to auth.users)
CREATE TABLE IF NOT EXISTS public.username_registry (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  username_lower TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Player Profiles (identity, customization, character & armory inventory)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 28),
  profile_picture_url TEXT,
  selected_avatar_id TEXT NOT NULL DEFAULT 'vanguard',
  bio TEXT NOT NULL DEFAULT 'Ready for arena deployment.' CHECK (char_length(bio) <= 220),
  profile_background_id TEXT NOT NULL DEFAULT 'foundry_hangar',
  profile_theme_id TEXT NOT NULL DEFAULT 'amber_vanguard',
  favorite_weapon_id TEXT NOT NULL DEFAULT 'pulse_rifle',
  selected_character_id TEXT NOT NULL DEFAULT 'vanguard',
  badges TEXT[] NOT NULL DEFAULT ARRAY['recruit'],
  showcase_badges TEXT[] NOT NULL DEFAULT ARRAY['recruit'],
  inventory TEXT[] NOT NULL DEFAULT ARRAY['pulse_rifle', 'tactical_sidearm'],
  coins INTEGER NOT NULL DEFAULT 1000 CHECK (coins >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Player Statistics
CREATE TABLE IF NOT EXISTS public.player_statistics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_kills INTEGER NOT NULL DEFAULT 0 CHECK (total_kills >= 0),
  total_deaths INTEGER NOT NULL DEFAULT 0 CHECK (total_deaths >= 0),
  total_wins INTEGER NOT NULL DEFAULT 0 CHECK (total_wins >= 0),
  total_losses INTEGER NOT NULL DEFAULT 0 CHECK (total_losses >= 0),
  total_matches_played INTEGER NOT NULL DEFAULT 0 CHECK (total_matches_played >= 0),
  win_rate NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Match History
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('1v1_duel', 'training_range', 'skirmish_3v3', 'solo_survival')),
  outcome TEXT NOT NULL CHECK (outcome IN ('victory', 'defeat')),
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  coins_earned INTEGER NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure existing databases also accept 1v1_duel and training_range modes
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_mode_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_mode_check
  CHECK (mode IN ('1v1_duel', 'training_range', 'skirmish_3v3', 'solo_survival'));

CREATE INDEX IF NOT EXISTS idx_profiles_player_id ON public.profiles(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_played ON public.matches(user_id, played_at DESC);

-- 5. Enable Row Level Security
ALTER TABLE public.username_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Username registry policies (owners can read/update their own row; availability via RPC)
DROP POLICY IF EXISTS "Users can view own username registry" ON public.username_registry;
CREATE POLICY "Users can view own username registry"
  ON public.username_registry FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own username registry" ON public.username_registry;
CREATE POLICY "Users can update own username registry"
  ON public.username_registry FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profiles policies (public read for scoreboard/player panel; owner-only updates)
DROP POLICY IF EXISTS "Public can view player profiles" ON public.profiles;
CREATE POLICY "Public can view player profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Player statistics policies
DROP POLICY IF EXISTS "Public can view player statistics" ON public.player_statistics;
CREATE POLICY "Public can view player statistics"
  ON public.player_statistics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own statistics" ON public.player_statistics;
CREATE POLICY "Users can update own statistics"
  ON public.player_statistics FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Match history policies
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
CREATE POLICY "Users can insert own matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Username availability check RPC (safe public lookup without exposing user_id)
CREATE OR REPLACE FUNCTION public.check_username_available(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned TEXT := trim(candidate);
BEGIN
  IF cleaned !~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RETURN FALSE;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.username_registry
    WHERE username_lower = lower(cleaned)
      AND user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
END;
$$;

-- 7. Automatic profile, username registry & stats initialization on user signup
CREATE OR REPLACE FUNCTION public.generate_player_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := 'IP-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE player_id = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_username TEXT := COALESCE(NEW.raw_user_meta_data ->> 'username', 'Player_' || substr(NEW.id::text, 1, 6));
  new_player_id TEXT := public.generate_player_id();
BEGIN
  INSERT INTO public.username_registry (user_id, username, username_lower)
  VALUES (NEW.id, raw_username, lower(raw_username));

  INSERT INTO public.profiles (user_id, player_id, username, display_name)
  VALUES (NEW.id, new_player_id, raw_username, raw_username);

  INSERT INTO public.player_statistics (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_player();

-- 8. Supabase Storage bucket and policies for profile avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 9. Live Multiplayer Tables (1v1 Rooms, Invites, Random Matchmaking Queue, Online Presence)
CREATE TABLE IF NOT EXISTS public.player_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'in_room', 'in_match')),
  current_room_code TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_rooms (
  code TEXT PRIMARY KEY,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_player_id TEXT NOT NULL,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_player_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  mode TEXT NOT NULL DEFAULT '1v1_duel' CHECK (mode IN ('1v1_duel')),
  max_kills INTEGER NOT NULL DEFAULT 5 CHECK (max_kills BETWEEN 1 AND 20),
  host_ready BOOLEAN NOT NULL DEFAULT TRUE,
  guest_ready BOOLEAN NOT NULL DEFAULT FALSE,
  host_kills INTEGER NOT NULL DEFAULT 0,
  guest_kills INTEGER NOT NULL DEFAULT 0,
  host_deaths INTEGER NOT NULL DEFAULT 0,
  guest_deaths INTEGER NOT NULL DEFAULT 0,
  host_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  guest_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  combat_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  winner_player_id TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_player_id TEXT NOT NULL,
  from_display_name TEXT NOT NULL,
  from_avatar_url TEXT,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_player_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  matched_room_code TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON public.player_presence(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.game_rooms(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_recipient ON public.room_invites(to_user_id, status, created_at DESC);

ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- 10. Explicit PostgreSQL privileges for API & server roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, UPDATE ON TABLE public.username_registry TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.player_statistics TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.matches TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated, service_role;


