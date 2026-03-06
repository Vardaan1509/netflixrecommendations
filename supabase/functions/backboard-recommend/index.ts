import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKBOARD_BASE_URL = 'https://app.backboard.io/api';

/**
 * Backboard-powered recommendation Edge Function
 * 
 * Flow:
 * 1. Authenticate user via Supabase auth
 * 2. Look up or create a persistent Backboard thread for the user
 * 3. Send the user's request through Backboard with memory="Auto"
 * 4. Backboard remembers all past preferences, ratings, and feedback
 * 5. Return personalized recommendations
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BACKBOARD_API_KEY = Deno.env.get('BACKBOARD_API_KEY')?.trim();
    const BACKBOARD_ASSISTANT_ID = Deno.env.get('BACKBOARD_ASSISTANT_ID')?.trim() || '4a2628e1-2439-4583-a2da-7dcabb2421bb';

    console.log('Backboard API key prefix:', BACKBOARD_API_KEY?.substring(0, 8));
    console.log('Backboard Assistant ID:', BACKBOARD_ASSISTANT_ID);

    if (!BACKBOARD_API_KEY || !BACKBOARD_ASSISTANT_ID) {
      throw new Error('Backboard configuration missing. Set BACKBOARD_API_KEY and BACKBOARD_ASSISTANT_ID.');
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

    // Parse request body
    const { message, preferences, watchedShows, region } = await req.json();

    // Look up user's Backboard thread ID
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('backboard_thread_id')
      .eq('user_id', user.id)
      .single();

    let threadId = profile?.backboard_thread_id;

    // Create a thread if one doesn't exist
    if (!threadId) {
      console.log('Creating new Backboard thread for user:', user.id);
      const createThreadRes = await fetch(
        `${BACKBOARD_BASE_URL}/assistants/${BACKBOARD_ASSISTANT_ID}/threads`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': BACKBOARD_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!createThreadRes.ok) {
        const errText = await createThreadRes.text();
        console.error('Failed to create Backboard thread:', createThreadRes.status, errText);
        throw new Error(`Failed to create Backboard thread: ${createThreadRes.status}`);
      }

      const threadData = await createThreadRes.json();
      threadId = threadData.thread_id || threadData.id;
      console.log('Created Backboard thread:', threadId);

      // Persist thread ID in user profile
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ backboard_thread_id: threadId })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to save thread ID:', updateError);
        // Continue anyway — we can retry on next request
      }
    }

    // Build the user message for Backboard
    // If the user typed a natural language message, use it directly
    // Otherwise, build from structured preferences
    let userMessage = '';
    if (message) {
      userMessage = message;
    } else if (preferences) {
      userMessage = buildPreferencesMessage(preferences, watchedShows, region);
    } else {
      userMessage = 'Give me some Netflix recommendations based on what you know about my taste.';
    }

    // Fetch previous recommendations to help avoid repeats
    const { data: pastRecs } = await supabaseClient
      .from('recommendations')
      .select('title')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const pastTitles = pastRecs?.map(r => r.title) || [];
    if (pastTitles.length > 0) {
      userMessage += `\n\nIMPORTANT: Do NOT recommend any of these titles (already shown): ${pastTitles.join(', ')}`;
    }

    console.log('Sending message to Backboard thread:', threadId);

    // Send message to Backboard with persistent memory
    const backboardRes = await fetch(
      `${BACKBOARD_BASE_URL}/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': BACKBOARD_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage,
          memory: 'Auto', // Backboard reads AND writes to persistent memory
        }),
      }
    );

    if (!backboardRes.ok) {
      const errText = await backboardRes.text();
      console.error('Backboard API error:', backboardRes.status, errText);
      throw new Error(`Backboard API error: ${backboardRes.status}`);
    }

    const backboardData = await backboardRes.json();
    const assistantReply = backboardData.content || backboardData.message || backboardData.response || '';

    console.log('Backboard response received, parsing recommendations');

    // Parse the assistant's response into structured recommendations
    const parsed = parseRecommendations(assistantReply);

    return new Response(
      JSON.stringify({
        recommendations: parsed.recommendations,
        memoryNote: parsed.memoryNote,
        rawResponse: assistantReply,
        threadId: threadId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backboard-recommend:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildPreferencesMessage(
  preferences: any,
  watchedShows: string[] = [],
  region: string = 'United States'
): string {
  const parts = [
    `I'm looking for Netflix recommendations.`,
    `My current mood: ${preferences.mood || 'not specified'}`,
    preferences.contentType ? `I want: ${preferences.contentType}` : '',
    preferences.genres?.length > 0 ? `Genres I like: ${preferences.genres.join(', ')}` : '',
    preferences.watchTime ? `Time available: ${preferences.watchTime}` : '',
    preferences.watchStyle ? `Watch style: ${preferences.watchStyle}` : '',
    preferences.language ? `Language preference: ${preferences.language}` : '',
    preferences.company ? `Watching: ${preferences.company}` : '',
    preferences.underrated ? `Interest in hidden gems: ${preferences.underrated}` : '',
    region ? `Netflix region: ${region}` : '',
    watchedShows.length > 0 ? `Already watched: ${watchedShows.join(', ')}` : '',
  ].filter(Boolean);

  return parts.join('\n');
}

function parseRecommendations(response: string): {
  recommendations: Array<{
    title: string;
    type: string;
    genre: string;
    description: string;
    matchReason: string;
    rating: string;
  }>;
  memoryNote: string;
} {
  // Try to extract JSON from the response
  try {
    // Look for JSON block in the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) ||
                      response.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return {
        recommendations: parsed.recommendations || [],
        memoryNote: parsed.memoryNote || '',
      };
    }

    // Try parsing the entire response as JSON
    const parsed = JSON.parse(response);
    return {
      recommendations: parsed.recommendations || [],
      memoryNote: parsed.memoryNote || '',
    };
  } catch {
    // If JSON parsing fails, return the raw response as a single "recommendation"
    // This handles cases where Backboard returns conversational text
    return {
      recommendations: [],
      memoryNote: response,
    };
  }
}
