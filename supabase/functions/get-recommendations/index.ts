import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const preferencesSchema = z.object({
  mood: z.string().max(100),
  contentType: z.string().max(50).optional(),
  watchTime: z.string().max(100),
  genres: z.array(z.string().max(50)).max(20),
  company: z.string().max(100),
  watchStyle: z.string().max(100),
  language: z.string().max(100),
  underrated: z.string().max(100)
});

const recommendationsRequestSchema = z.object({
  preferences: preferencesSchema,
  watchedShows: z.array(z.string().max(200)).max(100),
  region: z.string().max(100)
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validation = recommendationsRequestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: validation.error.format() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { preferences, watchedShows, region } = validation.data;
    console.log('Generating recommendations for region:', region, 'with', watchedShows.length, 'shows');

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let ratingHistory: Array<{ title: string; type: string; genre: string; user_rating: number; watched: boolean | null }> = [];

    let previouslyRecommended: string[] = [];
    
    // If user is authenticated, fetch their rating history and all previous recommendations
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) {
          userId = user.id;
          
          // Fetch ALL past recommendations to avoid repeats
          const { data: allPastRecs } = await supabaseClient
            .from('recommendations')
            .select('title')
            .eq('user_id', userId);
          
          if (allPastRecs && allPastRecs.length > 0) {
            previouslyRecommended = allPastRecs.map(r => r.title);
          }
          
          // Fetch user's past recommendations with ratings for learning
          const { data: pastRecs } = await supabaseClient
            .from('recommendations')
            .select('title, type, genre, user_rating, watched')
            .eq('user_id', userId)
            .not('user_rating', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20);

          if (pastRecs && pastRecs.length > 0) {
            ratingHistory = pastRecs;
          }
        }
      } catch (error) {
        console.log('Could not fetch rating history:', error);
      }
    }

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

    let ratingHistoryText = '';
    if (ratingHistory.length > 0) {
      const excellent = ratingHistory.filter(r => r.user_rating === 5);
      const good = ratingHistory.filter(r => r.user_rating === 4);
      const okay = ratingHistory.filter(r => r.user_rating === 3);
      const poor = ratingHistory.filter(r => r.user_rating === 2);
      const terrible = ratingHistory.filter(r => r.user_rating === 1);
      
      ratingHistoryText = `\n\nUser's Rating History (Learn from this!):
${excellent.length > 0 ? `⭐⭐⭐⭐⭐ LOVED (5/5) - Recommend similar content: ${excellent.map(r => `${r.title} (${r.type}, ${r.genre})`).join(', ')}` : ''}
${good.length > 0 ? `⭐⭐⭐⭐ LIKED (4/5) - These patterns work well: ${good.map(r => `${r.title} (${r.type}, ${r.genre})`).join(', ')}` : ''}
${okay.length > 0 ? `⭐⭐⭐ NEUTRAL (3/5) - Acceptable but not ideal: ${okay.map(r => `${r.title} (${r.type}, ${r.genre})`).join(', ')}` : ''}
${poor.length > 0 ? `⭐⭐ DISLIKED (2/5) - Avoid these patterns: ${poor.map(r => `${r.title} (${r.type}, ${r.genre})`).join(', ')}` : ''}
${terrible.length > 0 ? `⭐ HATED (1/5) - Strongly avoid similar content: ${terrible.map(r => `${r.title} (${r.type}, ${r.genre})`).join(', ')}` : ''}

CRITICAL: Use this granular feedback to fine-tune recommendations. Prioritize patterns from 5⭐ and 4⭐ content, avoid 1⭐ and 2⭐ patterns.`;
    }
    
    let excludeText = '';
    if (previouslyRecommended.length > 0) {
      excludeText = `\n\n🚫 PREVIOUSLY RECOMMENDED - DO NOT REPEAT THESE TITLES:
${previouslyRecommended.join(', ')}

CRITICAL: You MUST NOT recommend any of these titles again. They have already been shown to the user. Find fresh, new recommendations instead.`;
    }

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
${watchedShows.length > 0 ? watchedShows.join(', ') : 'None provided'}${ratingHistoryText}${excludeText}

Please provide 6 personalized recommendations that match their current state of mind based on how their day is going. Consider their language preferences, whether they're watching alone or with company, and if they want underrated content.${ratingHistory.length > 0 ? ' CRITICAL: Learn from their rating history to provide better matches.' : ''}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
