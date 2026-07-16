import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MAX_TITLE_LENGTH = 200;

export const useWatchedShows = (userId: string | undefined) => {
  const [shows, setShows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) {
      setShows([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("watched_shows")
        .select("title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) console.error("Error loading watched shows:", error);
      setShows(data?.map((r) => r.title) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const addShow = async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return false;

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your watched shows.",
        variant: "destructive",
      });
      return false;
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      toast({
        title: "Title too long",
        description: `Keep it under ${MAX_TITLE_LENGTH} characters.`,
        variant: "destructive",
      });
      return false;
    }
    if (shows.includes(trimmed)) return false;

    const { error } = await supabase
      .from("watched_shows")
      .insert({ user_id: userId, title: trimmed });
    if (error) {
      toast({ title: "Couldn't save", variant: "destructive" });
      return false;
    }
    setShows((prev) => [trimmed, ...prev]);
    return true;
  };

  const removeShow = async (title: string) => {
    if (!userId) return false;
    const { error } = await supabase
      .from("watched_shows")
      .delete()
      .eq("user_id", userId)
      .eq("title", title);
    if (error) {
      toast({ title: "Couldn't remove", variant: "destructive" });
      return false;
    }
    setShows((prev) => prev.filter((s) => s !== title));
    return true;
  };

  return { shows, loading, addShow, removeShow };
};
