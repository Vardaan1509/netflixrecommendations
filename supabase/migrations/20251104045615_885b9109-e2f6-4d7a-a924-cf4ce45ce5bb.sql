-- Create recommendations table to track what was recommended and user feedback
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  genre TEXT NOT NULL,
  description TEXT NOT NULL,
  match_reason TEXT NOT NULL,
  rating TEXT NOT NULL,
  user_rating INTEGER, -- 1 for thumbs down, 5 for thumbs up (null if not rated yet)
  watched BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Users can view their own recommendations
CREATE POLICY "Users can view their own recommendations"
ON public.recommendations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own recommendations
CREATE POLICY "Users can insert their own recommendations"
ON public.recommendations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own recommendations (for ratings)
CREATE POLICY "Users can update their own recommendations"
ON public.recommendations
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recommendations_updated_at
BEFORE UPDATE ON public.recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX idx_recommendations_created_at ON public.recommendations(created_at DESC);