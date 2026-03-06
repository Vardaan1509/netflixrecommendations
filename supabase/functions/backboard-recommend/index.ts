import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const configuredAssistantId = Deno.env.get('BACKBOARD_ASSISTANT_ID')?.trim();

    if (!BACKBOARD_API_KEY) {
      throw new Error('Backboard configuration missing. Set BACKBOARD_API_KEY.');
    }

    const resolvedAssistantId = await resolveAssistantId(BACKBOARD_API_KEY, configuredAssistantId);
    console.log('Using Backboard assistant ID:', resolvedAssistantId);

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
      threadId = await createBackboardThread(BACKBOARD_API_KEY, resolvedAssistantId);
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

    let backboardData = await sendBackboardMessage(BACKBOARD_API_KEY, threadId!, userMessage);
    let assistantReply = extractAssistantReply(backboardData);

    if (isBackboardPromptError(assistantReply)) {
      console.warn('Backboard thread returned prompt-template error. Recreating thread and retrying once.');

      const freshThreadId = await createBackboardThread(BACKBOARD_API_KEY, resolvedAssistantId);
      threadId = freshThreadId;

      const { error: threadUpdateError } = await supabaseClient
        .from('profiles')
        .update({ backboard_thread_id: freshThreadId })
        .eq('user_id', user.id);

      if (threadUpdateError) {
        console.error('Failed to save recreated thread ID:', threadUpdateError);
      }

      backboardData = await sendBackboardMessage(BACKBOARD_API_KEY, freshThreadId, userMessage);
      assistantReply = extractAssistantReply(backboardData);
    }

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

interface BackboardAssistant {
  assistant_id: string;
  name?: string;
}

const MANAGED_ASSISTANT_NAME = 'Netflix Recommendation Engine Managed';
const DEFAULT_ASSISTANT_SYSTEM_PROMPT = `You are a Netflix recommendation assistant with persistent memory.

Always return valid JSON with:
- recommendations: array of 3-5 items
- memoryNote: optional short string

Each recommendation object must include exactly these keys:
- title
- type
- genre
- description
- matchReason
- rating

Never suggest titles the user has already watched or disliked.`;

async function resolveAssistantId(
  apiKey: string,
  configuredAssistantId?: string
): Promise<string> {
  const assistantsRes = await fetch(`${BACKBOARD_BASE_URL}/assistants`, {
    headers: { 'X-API-Key': apiKey },
  });

  if (!assistantsRes.ok) {
    const errText = await assistantsRes.text();
    throw new Error(`Backboard assistants lookup failed: ${assistantsRes.status} ${errText}`);
  }

  const assistantsPayload = await assistantsRes.json();
  const assistants: BackboardAssistant[] = Array.isArray(assistantsPayload)
    ? assistantsPayload
    : assistantsPayload?.assistants ?? [];

  if (configuredAssistantId && assistants.some((a) => a.assistant_id === configuredAssistantId)) {
    return configuredAssistantId;
  }

  const managedAssistant = assistants.find((a) => a.name === MANAGED_ASSISTANT_NAME);
  if (managedAssistant?.assistant_id) {
    return managedAssistant.assistant_id;
  }

  const createAssistantRes = await fetch(`${BACKBOARD_BASE_URL}/assistants`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: MANAGED_ASSISTANT_NAME,
      system_prompt: DEFAULT_ASSISTANT_SYSTEM_PROMPT,
      description: 'Personalized Netflix recommendations with memory',
    }),
  });

  if (!createAssistantRes.ok) {
    const errText = await createAssistantRes.text();
    throw new Error(`Backboard assistant creation failed: ${createAssistantRes.status} ${errText}`);
  }

  const createdAssistant = await createAssistantRes.json();
  const createdAssistantId = createdAssistant?.assistant_id || createdAssistant?.id;

  if (!createdAssistantId) {
    throw new Error('Backboard assistant creation succeeded but returned no assistant_id.');
  }

  console.log('Created managed Backboard assistant:', createdAssistantId);
  return createdAssistantId;
}

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
