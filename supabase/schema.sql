-- ============================================================================
-- Smart Netflix Recommendations — Consolidated Supabase Schema
-- ============================================================================
-- One-shot setup script for a FRESH Supabase project.
--
-- HOW TO USE (choose ONE approach):
--   A) Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   B) CLI: psql "$DATABASE_URL" -f supabase/schema.sql
--
-- This is the consolidated equivalent of everything under supabase/migrations.
-- If you instead run `supabase db push` with the migration files, you do NOT
-- also need to run this file. It is idempotent (safe to re-run).
--
-- Objects created:
--   - extension: vector (pgvector)
--   - tables: profiles, watched_shows, recommendations, show_embeddings
--   - functions: update_updated_at_column, handle_new_user, match_show_embeddings
--   - triggers: updated_at auto-touch, auto-create profile on signup
--   - Row Level Security policies for per-user data isolation
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Shared helper: auto-update updated_at columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------------------------------------------------------------------------
-- Table: profiles
-- One row per auth user. backboard_thread_id links the user to their
-- persistent Backboard memory thread.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  backboard_thread_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Auto-create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Table: watched_shows
-- Titles the user has already seen (fed into the recommendation prompts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watched_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, title)
);

ALTER TABLE public.watched_shows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own watched shows" ON public.watched_shows;
CREATE POLICY "Users can view their own watched shows"
  ON public.watched_shows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own watched shows" ON public.watched_shows;
CREATE POLICY "Users can insert their own watched shows"
  ON public.watched_shows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own watched shows" ON public.watched_shows;
CREATE POLICY "Users can delete their own watched shows"
  ON public.watched_shows FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watched_shows_user_id ON public.watched_shows(user_id);

-- ---------------------------------------------------------------------------
-- Table: recommendations
-- Every recommendation shown to the user, plus their feedback
-- (user_rating 1-5, watched flag). Powers the learning loop and repeat-avoidance.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  genre TEXT NOT NULL,
  description TEXT NOT NULL,
  match_reason TEXT NOT NULL,
  rating TEXT NOT NULL,
  user_rating INTEGER,               -- 1-5 stars; NULL until the user rates it
  watched BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recommendations" ON public.recommendations;
CREATE POLICY "Users can view their own recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own recommendations" ON public.recommendations;
CREATE POLICY "Users can insert their own recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recommendations" ON public.recommendations;
CREATE POLICY "Users can update their own recommendations"
  ON public.recommendations FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_recommendations_updated_at ON public.recommendations;
CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON public.recommendations(created_at DESC);
-- Serves the per-request "rated history" query (user + rated rows, by recency).
CREATE INDEX IF NOT EXISTS idx_recommendations_user_rated
  ON public.recommendations (user_id, created_at DESC)
  WHERE user_rating IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Table: show_embeddings
-- Embeddings via OpenRouter (openai/text-embedding-3-small, 1536 dims) for
-- shows the user rated 4-5 stars. Generated on rating; retained for a future
-- embedding-based re-ranking of catalog candidates. NOTE: the current
-- recommendation pipeline (TMDB retrieval + LLM finalize) does not read these
-- yet — they are staged for that enhancement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.show_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  user_rating INTEGER NOT NULL CHECK (user_rating >= 4 AND user_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, title)
);

ALTER TABLE public.show_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own embeddings" ON public.show_embeddings;
CREATE POLICY "Users can view their own embeddings"
  ON public.show_embeddings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own embeddings" ON public.show_embeddings;
CREATE POLICY "Users can insert their own embeddings"
  ON public.show_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own embeddings" ON public.show_embeddings;
CREATE POLICY "Users can update their own embeddings"
  ON public.show_embeddings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON public.show_embeddings;
CREATE POLICY "Users can delete their own embeddings"
  ON public.show_embeddings FOR DELETE
  USING (auth.uid() = user_id);

-- Cosine-distance index for fast similarity search
CREATE INDEX IF NOT EXISTS show_embeddings_user_embedding_idx ON public.show_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS show_embeddings_user_id_idx ON public.show_embeddings(user_id);

DROP TRIGGER IF EXISTS update_show_embeddings_updated_at ON public.show_embeddings;
CREATE TRIGGER update_show_embeddings_updated_at
  BEFORE UPDATE ON public.show_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Function: match_show_embeddings
-- Returns the most cosine-similar shows to a query embedding.
-- Retained for a future embedding-based re-ranking step; not currently called
-- by the recommendation pipeline.
-- ---------------------------------------------------------------------------
-- Scoped to auth.uid() so a request only matches the caller's own embeddings
-- (never other users' private ratings). Anonymous calls match no rows.
CREATE OR REPLACE FUNCTION public.match_show_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  title text,
  description text,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    title,
    description,
    1 - (embedding <=> query_embedding) AS similarity
  FROM show_embeddings
  WHERE user_id = auth.uid()
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================================
-- Done. Next steps (outside this file):
--   1. Set Edge Function secrets:
--        supabase secrets set \
--          OPENROUTER_API_KEY=...  OPENROUTER_MODEL=google/gemini-3-flash-preview \
--          TMDB_ACCESS_TOKEN=... \
--          BACKBOARD_API_KEY=...   BACKBOARD_ASSISTANT_ID=... \
--          UPSTASH_REDIS_REST_URL=...  UPSTASH_REDIS_REST_TOKEN=... \
--          ALLOWED_ORIGINS=https://your-production-domain
--   2. Deploy the functions:
--        supabase functions deploy get-next-question
--        supabase functions deploy get-recommendations
--        supabase functions deploy generate-embedding
--        supabase functions deploy backboard-recommend
--        supabase functions deploy backboard-feedback
--   3. Put VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY in your .env
-- ============================================================================
