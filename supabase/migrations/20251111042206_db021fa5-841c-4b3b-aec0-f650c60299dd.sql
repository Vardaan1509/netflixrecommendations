-- Create function to find similar shows using vector cosine similarity
-- This is the core of STEP 3: Vector Similarity Search
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