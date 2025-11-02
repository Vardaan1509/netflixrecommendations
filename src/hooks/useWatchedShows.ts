import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useWatchedShows = (userId: string | undefined) => {
  const [shows, setShows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load watched shows from database
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadShows = async () => {
      try {
        const { data, error } = await supabase
          .from("watched_shows")
          .select("title")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setShows(data?.map(item => item.title) || []);
      } catch (error: any) {
        console.error("Error loading watched shows:", error);
      } finally {
        setLoading(false);
      }
    };

    loadShows();
  }, [userId]);

  const addShow = async (title: string) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your watched shows.",
        variant: "destructive",
      });
      return false;
    }

    if (!title.trim() || shows.includes(title.trim())) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("watched_shows")
        .insert({ user_id: userId, title: title.trim() });

      if (error) throw error;

      setShows([title.trim(), ...shows]);
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save show. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeShow = async (title: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("watched_shows")
        .delete()
        .eq("user_id", userId)
        .eq("title", title);

      if (error) throw error;

      setShows(shows.filter(s => s !== title));
      return true;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove show. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  return { shows, loading, addShow, removeShow, setShows };
};
