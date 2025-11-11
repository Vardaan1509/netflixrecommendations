-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table to store show embeddings
CREATE TABLE public.show_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small creates 1536-dimensional vectors
  user_rating INTEGER NOT NULL CHECK (user_rating >= 4 AND user_rating <= 5), -- Only store high-rated shows
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, title) -- Prevent duplicate embeddings per user per show
);

-- Enable Row Level Security
ALTER TABLE public.show_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own embeddings
CREATE POLICY "Users can view their own embeddings"
  ON public.show_embeddings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own embeddings"
  ON public.show_embeddings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own embeddings"
  ON public.show_embeddings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own embeddings"
  ON public.show_embeddings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster vector similarity search using cosine distance
CREATE INDEX show_embeddings_user_embedding_idx ON public.show_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for faster user lookups
CREATE INDEX show_embeddings_user_id_idx ON public.show_embeddings(user_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_show_embeddings_updated_at
  BEFORE UPDATE ON public.show_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();