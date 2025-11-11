-- Fix function search path security issue
DROP FUNCTION IF EXISTS match_show_embeddings(vector(1536), float, int);

CREATE OR REPLACE FUNCTION match_show_embeddings(
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
    1 - (embedding <=> query_embedding) as similarity
  FROM show_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;