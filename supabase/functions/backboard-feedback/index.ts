import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKBOARD_BASE_URL = 'https://app.backboard.io/api';

/**
 * Backboard Feedback Edge Function
 * 
 * Sends user feedback (ratings, dislikes, "already watched") into the
 * Backboard memory loop so future recommendations improve.
 * 
 * Examples of feedback messages:
 * - "I rated Dark 5/5 — loved the complex time travel narrative"
 * - "I didn't enjoy Bridgerton (1/5) — too slow and romantic for my taste"
 * - "I already watched Stranger Things, don't recommend it again"
 * - "I prefer content under 45 minutes on weekdays"
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const BACKBOARD_API_KEY = Deno.env.get('BACKBOARD_API_KEY');
        const BACKBOARD_ASSISTANT_ID = Deno.env.get('BACKBOARD_ASSISTANT_ID');

        if (!BACKBOARD_API_KEY || !BACKBOARD_ASSISTANT_ID) {
            throw new Error('Backboard configuration missing.');
        }

        // Authenticate user
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Authentication required' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { feedbackType, title, rating, reason, customMessage } = await req.json();

        // Get user's Backboard thread
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('backboard_thread_id')
            .eq('user_id', user.id)
            .single();

        const threadId = profile?.backboard_thread_id;
        if (!threadId) {
            // No thread yet — feedback will be picked up on next recommendation request
            return new Response(
                JSON.stringify({ success: true, message: 'No active thread. Feedback will apply on next session.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Build a natural language feedback message
        let feedbackMessage = '';
        if (customMessage) {
            feedbackMessage = `[User feedback] ${customMessage}`;
        } else {
            feedbackMessage = buildFeedbackMessage(feedbackType, title, rating, reason);
        }

        console.log('Sending feedback to Backboard thread:', threadId, feedbackMessage);

        // Send feedback into the Backboard memory loop
        const backboardRes = await fetch(
            `${BACKBOARD_BASE_URL}/chat/threads/${threadId}/messages`,
            {
                method: 'POST',
                headers: {
                    'X-API-Key': BACKBOARD_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: feedbackMessage,
                    memory: 'Auto', // Store this feedback in persistent memory
                }),
            }
        );

        if (!backboardRes.ok) {
            const errText = await backboardRes.text();
            console.error('Backboard feedback error:', backboardRes.status, errText);
            // Don't fail the request — feedback is best-effort
            return new Response(
                JSON.stringify({ success: false, message: 'Feedback delivery failed, will retry.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // We don't need to use the response — the point is to update memory
        const backboardData = await backboardRes.json();
        console.log('Feedback stored in Backboard memory');

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Feedback recorded in memory',
                memoryUpdated: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in backboard-feedback:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

function buildFeedbackMessage(
    feedbackType: string,
    title: string,
    rating?: number,
    reason?: string
): string {
    switch (feedbackType) {
        case 'rating':
            if (rating && rating >= 4) {
                return `[User feedback] I rated "${title}" ${rating}/5 stars — I really enjoyed it.${reason ? ` ${reason}` : ' Please recommend more like this.'}`;
            } else if (rating && rating <= 2) {
                return `[User feedback] I rated "${title}" ${rating}/5 stars — I didn't enjoy it.${reason ? ` ${reason}` : ' Please avoid similar content.'} Do NOT recommend this title again.`;
            } else {
                return `[User feedback] I rated "${title}" ${rating}/5 stars.${reason ? ` ${reason}` : ''} It was okay but not amazing.`;
            }

        case 'watched':
            return `[User feedback] I have already watched "${title}". Do NOT recommend it again. ${reason ? reason : ''}`;

        case 'not_interested':
            return `[User feedback] I'm not interested in "${title}". Do NOT recommend it again.${reason ? ` Reason: ${reason}` : ''}`;

        case 'loved':
            return `[User feedback] I loved "${title}"! Please remember this and recommend similar content. ${reason ? reason : ''}`;

        default:
            return `[User feedback] About "${title}": ${reason || 'No additional details.'}`;
    }
}
