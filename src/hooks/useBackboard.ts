import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

export interface BackboardRecommendation {
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
}

interface FeedbackPayload {
  feedbackType: "rating" | "watched" | "not_interested" | "loved";
  title: string;
  rating?: number;
  reason?: string;
}

interface RecommendArgs {
  message?: string;
  watchedShows?: string[];
  region?: string;
}

const invoke = async <T,>(
  name: string,
  body: unknown,
  accessToken: string
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  return data as T;
};

export const useBackboard = (session: Session | null) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = useCallback(
    async ({ message, watchedShows, region }: RecommendArgs): Promise<BackboardRecommendation[]> => {
      if (!session?.access_token) {
        setError("Sign in to use memory-powered recommendations");
        return [];
      }
      setLoading(true);
      setError(null);
      try {
        const data = await invoke<{ recommendations?: BackboardRecommendation[] }>(
          "backboard-recommend",
          { message, watchedShows, region },
          session.access_token
        );
        return data.recommendations ?? [];
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get recommendations");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  const sendFeedback = useCallback(
    async (feedback: FeedbackPayload): Promise<boolean> => {
      if (!session?.access_token) return false;
      try {
        await invoke("backboard-feedback", feedback, session.access_token);
        return true;
      } catch (err) {
        console.error("Backboard feedback error:", err);
        return false;
      }
    },
    [session]
  );

  return { loading, error, getRecommendations, sendFeedback };
};
