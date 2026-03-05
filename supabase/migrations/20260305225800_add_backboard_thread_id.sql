-- Add backboard_thread_id to profiles for persistent Backboard thread per user
ALTER TABLE public.profiles 
ADD COLUMN backboard_thread_id TEXT;
