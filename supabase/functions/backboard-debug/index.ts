import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const BACKBOARD_API_KEY = Deno.env.get('BACKBOARD_API_KEY')?.trim();
  const BASE_URL = 'https://app.backboard.io/api';

  const systemPrompt = `You are a Netflix Recommendation Expert with persistent memory. Your job is to recommend shows and movies available on Netflix based on user preferences, mood, viewing history, and past feedback.

RULES:
1. Always respond with a JSON object containing a "recommendations" array and optional "memoryNote" string.
2. Each recommendation must have: title, type (Movie/Series/Documentary/Limited Series), genre, description (2-3 sentences), matchReason (why this matches their taste), rating (e.g. "8.5/10").
3. Provide 3-5 recommendations per request unless asked otherwise.
4. NEVER recommend shows the user has already watched or rated poorly.
5. Use your memory of past conversations to improve recommendations over time.
6. If the user gives feedback (ratings, "loved it", "hated it"), acknowledge and adapt.
7. Consider the user's Netflix region when making recommendations.

RESPONSE FORMAT (always valid JSON):
{
  "recommendations": [
    {
      "title": "Show Name",
      "type": "Series",
      "genre": "Thriller, Drama",
      "description": "A gripping story about...",
      "matchReason": "Based on your love of dark narratives...",
      "rating": "8.7/10"
    }
  ],
  "memoryNote": "User prefers dark thrillers and anime"
}`;

  const res = await fetch(`${BASE_URL}/assistants`, {
    method: 'POST',
    headers: {
      'X-API-Key': BACKBOARD_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Netflix Recommendation Engine',
      system_prompt: systemPrompt,
      description: 'AI-powered Netflix recommendation assistant with persistent memory for personalized suggestions.',
    }),
  });

  const data = await res.json();
  console.log('Created assistant:', JSON.stringify(data));

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
