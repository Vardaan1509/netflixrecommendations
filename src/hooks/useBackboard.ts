import { useState, useCallback } from "react";
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

interface BackboardResponse {
    recommendations: BackboardRecommendation[];
    memoryNote: string;
    rawResponse: string;
    threadId: string;
}

interface FeedbackPayload {
    feedbackType: "rating" | "watched" | "not_interested" | "loved";
    title: string;
    rating?: number;
    reason?: string;
}

export const useBackboard = (session: Session | null) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recommendations, setRecommendations] = useState<BackboardRecommendation[]>([]);
    const [memoryNote, setMemoryNote] = useState<string>("");
    const [rawResponse, setRawResponse] = useState<string>("");

    const getRecommendations = useCallback(
        async (
            message?: string,
            preferences?: any,
            watchedShows?: string[],
            region?: string
        ): Promise<BackboardRecommendation[]> => {
            if (!session?.access_token) {
                setError("Sign in to use memory-powered recommendations");
                return [];
            }

            setLoading(true);
            setError(null);

            try {
                const { data, error: fnError } = await supabase.functions.invoke(
                    "backboard-recommend",
                    {
                        body: { message, preferences, watchedShows, region },
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                );

                if (fnError) throw fnError;

                const response = data as BackboardResponse;
                setRecommendations(response.recommendations || []);
                setMemoryNote(response.memoryNote || "");
                setRawResponse(response.rawResponse || "");

                return response.recommendations || [];
            } catch (err: any) {
                const msg = err?.message || "Failed to get recommendations";
                setError(msg);
                console.error("Backboard recommend error:", err);
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
                const { error: fnError } = await supabase.functions.invoke(
                    "backboard-feedback",
                    {
                        body: feedback,
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                );

                if (fnError) {
                    console.error("Backboard feedback error:", fnError);
                    return false;
                }

                return true;
            } catch (err) {
                console.error("Backboard feedback error:", err);
                return false;
            }
        },
        [session]
    );

    const sendCustomFeedback = useCallback(
        async (customMessage: string): Promise<boolean> => {
            if (!session?.access_token) return false;

            try {
                const { error: fnError } = await supabase.functions.invoke(
                    "backboard-feedback",
                    {
                        body: { customMessage },
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                );

                if (fnError) {
                    console.error("Backboard custom feedback error:", fnError);
                    return false;
                }

                return true;
            } catch (err) {
                console.error("Backboard custom feedback error:", err);
                return false;
            }
        },
        [session]
    );

    return {
        loading,
        error,
        recommendations,
        memoryNote,
        rawResponse,
        getRecommendations,
        sendFeedback,
        sendCustomFeedback,
        setRecommendations,
    };
};
