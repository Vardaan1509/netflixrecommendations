import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { preferences, watchedShows, region } = await req.json();
    console.log('Generating recommendations with:', { preferences, watchedShows, region });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a Netflix recommendation expert with VERIFIED knowledge of regional content catalogs. You MUST cross-reference each recommendation against the specific region's Netflix library before including it.

Return EXACTLY 6 recommendations in JSON format with this structure:
{
  "recommendations": [
    {
      "title": "Show/Movie Title",
      "type": "Series" or "Movie",
      "genre": "Primary Genre",
      "description": "Brief compelling description (2-3 sentences)",
      "matchReason": "Why this matches their preferences (1 sentence)",
      "rating": "8.5" (string format)
    }
  ]
}

⚠️ ABSOLUTE CRITICAL REQUIREMENTS - REGIONAL AVAILABILITY:
1. You MUST ONLY recommend content that is 100% CONFIRMED available in ${region}
2. BEFORE including ANY title, verify it is currently streaming in ${region}
3. If you have ANY doubt about regional availability, DO NOT include that title
4. For Canada specifically:
   - Many US Netflix exclusives are NOT available
   - Many documentaries and older films have different availability
   - Verify each title specifically for Canadian Netflix
5. Double and triple-check EVERY recommendation is streamable in ${region}
6. When in doubt, choose more mainstream/popular titles that are definitely available

CONTENT TYPE REQUIREMENTS:
- User preference: ${preferences.contentType || 'both'}
- STRICTLY follow their content type preference
- If "Movies only" → recommend ONLY movies
- If "Series only" → recommend ONLY series  
- If "Both" → provide a mix

Additional Focus:
- Match their specific mood: ${preferences.mood}
- Align with their genre preferences
- Consider watch history to avoid repeats and find similar content
- Provide diverse recommendations across sub-genres
- Prioritize HIGH-CONFIDENCE regional availability over perfect preference matching`;

    const userPrompt = `User Preferences:
- How their day is going: ${preferences.mood}
- Content Type: ${preferences.contentType || 'both movies and series'}
- Genres: ${preferences.genres.join(', ')}
- Watch Time: ${preferences.watchTime}
- Watch Style: ${preferences.watchStyle}
- Language/Subtitles: ${preferences.language}
- Watching: ${preferences.company}
- Interested in underrated content: ${preferences.underrated}
- Netflix Region: ${region} ⚠️ CRITICAL: Verify ALL recommendations are available in this specific region

Recently Watched Shows:
${watchedShows.length > 0 ? watchedShows.join(', ') : 'None provided'}

Please provide 6 personalized recommendations that match their current state of mind based on how their day is going. Consider their language preferences, whether they're watching alone or with company, and if they want underrated content.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('AI Response:', content);
    
    const recommendations = JSON.parse(content);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-recommendations function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
