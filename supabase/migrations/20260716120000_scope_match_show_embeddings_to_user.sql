-- ============================================================================
-- Security fix: scope match_show_embeddings to the calling user.
--
-- The original function ran as SECURITY DEFINER and queried the ENTIRE
-- show_embeddings table with no user filter — so one user's similarity search
-- could surface titles derived from another user's private ratings. It also
-- meant recommendations were polluted by strangers' taste.
--
-- Fix: filter by auth.uid() so a request only ever matches against its own
-- embeddings. auth.uid() reads the JWT claims PostgREST sets per request, so
-- it resolves to the authenticated caller. For anonymous calls it is NULL and
-- `user_id = NULL` matches no rows — a safe empty result.
-- ============================================================================

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
