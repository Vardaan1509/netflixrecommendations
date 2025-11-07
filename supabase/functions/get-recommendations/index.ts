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
  underrated: z.string().max(100).optional(),
  ageRating: z.string().max(100).optional()
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
    console.log('Recommendation request', {
      timestamp: new Date().toISOString(),
      region,
      showCount: watchedShows?.length || 0,
      hasPreferences: !!preferences
    });

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let ratingHistory: Array<{ title: string; type: string; genre: string; user_rating: number; watched: boolean | null; match_reason: string }> = [];

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
            .select('title, type, genre, user_rating, watched, match_reason')
            .eq('user_id', userId)
            .not('user_rating', 'is', null)
            .order('created_at', { ascending: false })
            .limit(30);

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

🚨 ABSOLUTE CRITICAL REQUIREMENTS - REGIONAL AVAILABILITY (MOST IMPORTANT):
1. You MUST ONLY recommend content that is 100% CONFIRMED available in ${region}
2. BEFORE including ANY title, ASK YOURSELF: "Is this DEFINITELY streaming in ${region} RIGHT NOW?"
3. If you have even 1% doubt about regional availability, DO NOT include that title
4. Regional availability differences are COMMON and SIGNIFICANT:
   ${region === 'Canada' ? `
   - Canada DOES NOT HAVE: The Good Place, Parks and Recreation, The Office (US), many NBC shows
   - Canada DOES NOT HAVE: Dungeons and Dragons (Honor Among Thieves), many HBO shows, AMC shows that are on US Netflix
   - Canada DOES NOT HAVE: Many popular US documentaries, independent films, and recent theatrical releases
   - Canada DOES NOT HAVE: Most content from Paramount+, Peacock, or Hulu originals
   - Canada DOES HAVE: Different content deals, many international shows not on US Netflix, more British content
   - VERIFY TWICE: Canada's catalog is SIGNIFICANTLY different from US - do not assume US availability means Canada availability` : ''}
5. Triple-check EVERY recommendation against ${region}'s current catalog
6. When uncertain, choose ONLY globally popular Netflix Originals that are available worldwide (like Squid Game, Stranger Things, The Crown, Wednesday, etc.)
7. BETTER TO RECOMMEND SOMETHING BORING BUT AVAILABLE than something perfect but unavailable
8. If you recommend something that is NOT available in ${region}, it will create a terrible user experience

CONTENT TYPE REQUIREMENTS:
- User preference: ${preferences.contentType || 'both'}
- STRICTLY follow their content type preference
- If "Movies only" → recommend ONLY movies
- If "Series only" → recommend ONLY series  
- If "Both" → provide a mix

🎯 GENRE DIVERSITY REQUIREMENT (CRITICAL):
- User selected these genres: ${preferences.genres.join(', ')}
- DO NOT focus heavily on just one or two genres
- SPREAD recommendations across MULTIPLE genres from their list
- If they like Comedy AND Animation, don't give 4 animated comedies - give variety (1-2 comedies, 1-2 animated shows, 1-2 other genres)
- Maximum 2 recommendations per genre category
- Ensure diverse sub-genres and styles within their preferences

🎬 CONTENT MATURITY REQUIREMENT:
- User's age rating preference: ${preferences.ageRating || 'No preference'}
- If "Family-friendly" → ONLY G, PG, TV-G, TV-PG rated content
- If "Teen and up" → PG-13, TV-14 and below
- If "Mature content" → All ratings including R, TV-MA
- If "No preference" → Any rating is fine

Additional Focus:
- Match their specific mood: ${preferences.mood}
- Consider watch history to avoid repeats and find similar content
- Balance between their preferences while maintaining variety
- Prioritize HIGH-CONFIDENCE regional availability over perfect preference matching`;

    // ============= IMPROVEMENT #2: RICHER CONTEXT WITH REASONS =============
    // ============= IMPROVEMENT #3: RATING PATTERN ANALYSIS =============
    // ============= IMPROVEMENT #4: WATCHED STATUS AS STRONG SIGNAL =============
    let ratingHistoryText = '';
    let patternAnalysisText = '';
    let watchedSignalsText = '';
    
    if (ratingHistory.length > 0) {
      // Weight recent ratings more heavily (last 10 vs older ones)
      const recentRatings = ratingHistory.slice(0, 10);
      const olderRatings = ratingHistory.slice(10);
      
      // ============= IMPROVEMENT #2: Richer Context =============
      // Separate by rating with WHY they liked/disliked (match_reason)
      const loved = ratingHistory.filter(r => r.user_rating >= 4);
      const disliked = ratingHistory.filter(r => r.user_rating <= 2);
      
      let richContextText = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      richContextText += '📊 DETAILED USER PREFERENCE ANALYSIS (USE THIS TO LEARN)\n';
      richContextText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      if (loved.length > 0) {
        richContextText += '✅ HIGH-RATED CONTENT (4-5 stars) - PRIORITIZE THESE PATTERNS:\n';
        loved.forEach(r => {
          richContextText += `   • "${r.title}" (${r.type}, ${r.genre}) - ⭐${r.user_rating}/5\n`;
          richContextText += `     WHY THEY LOVED IT: ${r.match_reason}\n`;
        });
        richContextText += '\n';
      }
      
      if (disliked.length > 0) {
        richContextText += '❌ LOW-RATED CONTENT (1-2 stars) - AVOID THESE PATTERNS:\n';
        disliked.forEach(r => {
          richContextText += `   • "${r.title}" (${r.type}, ${r.genre}) - ⭐${r.user_rating}/5\n`;
          richContextText += `     WHY THEY DISLIKED IT: ${r.match_reason}\n`;
        });
        richContextText += '\n';
      }
      
      richContextText += '⚡ RECENT PREFERENCES (Last 10 ratings - weight these MORE heavily):\n';
      recentRatings.forEach(r => {
        richContextText += `   • "${r.title}" - ⭐${r.user_rating}/5 (${r.type}, ${r.genre})\n`;
      });
      
      ratingHistoryText = richContextText;
      
      // ============= IMPROVEMENT #3: Rating Pattern Analysis =============
      // Calculate genre statistics
      const genreStats: { [key: string]: { total: number; count: number } } = {};
      ratingHistory.forEach(r => {
        if (!genreStats[r.genre]) {
          genreStats[r.genre] = { total: 0, count: 0 };
        }
        genreStats[r.genre].total += r.user_rating;
        genreStats[r.genre].count += 1;
      });
      
      const genreAverages = Object.entries(genreStats)
        .map(([genre, stats]) => ({
          genre,
          avg: stats.total / stats.count,
          count: stats.count
        }))
        .sort((a, b) => b.avg - a.avg);
      
      // Calculate content type statistics
      const seriesRatings = ratingHistory.filter(r => r.type.toLowerCase().includes('series'));
      const movieRatings = ratingHistory.filter(r => r.type.toLowerCase().includes('movie'));
      
      const seriesAvg = seriesRatings.length > 0 
        ? seriesRatings.reduce((sum, r) => sum + r.user_rating, 0) / seriesRatings.length 
        : 0;
      const movieAvg = movieRatings.length > 0 
        ? movieRatings.reduce((sum, r) => sum + r.user_rating, 0) / movieRatings.length 
        : 0;
      
      patternAnalysisText = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      patternAnalysisText += '📈 STATISTICAL PATTERN ANALYSIS (DATA-DRIVEN INSIGHTS)\n';
      patternAnalysisText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      if (genreAverages.length > 0) {
        const topGenres = genreAverages.filter(g => g.avg >= 4.0);
        const poorGenres = genreAverages.filter(g => g.avg <= 2.5);
        
        if (topGenres.length > 0) {
          patternAnalysisText += '🎯 HIGHEST-RATED GENRES (Focus recommendations here):\n';
          topGenres.forEach(g => {
            patternAnalysisText += `   • ${g.genre}: ${g.avg.toFixed(1)} avg rating (from ${g.count} ${g.count === 1 ? 'rating' : 'ratings'})\n`;
          });
          patternAnalysisText += '\n';
        }
        
        if (poorGenres.length > 0) {
          patternAnalysisText += '⚠️ LOWEST-RATED GENRES (Avoid or be very selective):\n';
          poorGenres.forEach(g => {
            patternAnalysisText += `   • ${g.genre}: ${g.avg.toFixed(1)} avg rating (from ${g.count} ${g.count === 1 ? 'rating' : 'ratings'})\n`;
          });
          patternAnalysisText += '\n';
        }
      }
      
      if (seriesRatings.length > 0 || movieRatings.length > 0) {
        patternAnalysisText += '🎬 CONTENT TYPE PREFERENCE:\n';
        if (seriesRatings.length > 0) {
          patternAnalysisText += `   • TV Series: ${seriesAvg.toFixed(1)} avg rating (${seriesRatings.length} ratings)\n`;
        }
        if (movieRatings.length > 0) {
          patternAnalysisText += `   • Movies: ${movieAvg.toFixed(1)} avg rating (${movieRatings.length} ratings)\n`;
        }
        
        const preference = Math.abs(seriesAvg - movieAvg) > 0.5 
          ? (seriesAvg > movieAvg ? 'STRONGLY prefers TV Series' : 'STRONGLY prefers Movies')
          : 'No strong preference between Series and Movies';
        patternAnalysisText += `   📊 INSIGHT: User ${preference}\n\n`;
      }
      
      // ============= IMPROVEMENT #4: Watched Status as Strong Signal =============
      const watchedAndLoved = ratingHistory.filter(r => r.watched === true && r.user_rating >= 4);
      const likedButNotWatched = ratingHistory.filter(r => (r.watched === false || r.watched === null) && r.user_rating >= 4);
      const watchedAndDisliked = ratingHistory.filter(r => r.watched === true && r.user_rating <= 2);
      
      watchedSignalsText = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      watchedSignalsText += '🎯 WATCHED STATUS SIGNALS (CONFIDENCE LEVELS)\n';
      watchedSignalsText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      if (watchedAndLoved.length > 0) {
        watchedSignalsText += '🏆 WATCHED & LOVED (HIGHEST CONFIDENCE - STRONGEST SIGNAL):\n';
        watchedSignalsText += '   These are CONFIRMED great matches - user actually watched AND loved them.\n';
        watchedSignalsText += '   ⚡ CRITICAL: Prioritize finding content VERY similar to these:\n';
        watchedAndLoved.forEach(r => {
          watchedSignalsText += `   • "${r.title}" (${r.type}, ${r.genre}) - ⭐${r.user_rating}/5 ✓ Watched\n`;
        });
        watchedSignalsText += '\n';
      }
      
      if (likedButNotWatched.length > 0) {
        watchedSignalsText += '💭 RATED HIGH BUT NOT WATCHED (LOWER CONFIDENCE):\n';
        watchedSignalsText += '   User liked the idea but hasn\'t actually watched these yet.\n';
        watchedSignalsText += '   ⚠️ Consider these preferences but don\'t over-weight them:\n';
        likedButNotWatched.forEach(r => {
          watchedSignalsText += `   • "${r.title}" (${r.type}, ${r.genre}) - ⭐${r.user_rating}/5 ✗ Not watched\n`;
        });
        watchedSignalsText += '\n';
      }
      
      if (watchedAndDisliked.length > 0) {
        watchedSignalsText += '🚫 WATCHED BUT DISLIKED (STRONG NEGATIVE SIGNAL):\n';
        watchedSignalsText += '   User gave these a chance by watching but didn\'t enjoy them.\n';
        watchedSignalsText += '   ❌ ACTIVELY AVOID content with similar patterns:\n';
        watchedAndDisliked.forEach(r => {
          watchedSignalsText += `   • "${r.title}" (${r.type}, ${r.genre}) - ⭐${r.user_rating}/5 ✓ Watched but disliked\n`;
        });
        watchedSignalsText += '\n';
      }
      
      watchedSignalsText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      watchedSignalsText += 'RECOMMENDATION STRATEGY:\n';
      watchedSignalsText += '1. Find shows VERY similar to "Watched & Loved" (highest priority)\n';
      watchedSignalsText += '2. Consider patterns from "Rated High but Not Watched" (medium priority)\n';
      watchedSignalsText += '3. Strongly avoid patterns from "Watched but Disliked" (critical)\n';
      watchedSignalsText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    }
    
    let excludeText = '';
    if (previouslyRecommended.length > 0) {
      excludeText = `\n\n🚫🚫🚫 PREVIOUSLY RECOMMENDED - ABSOLUTE PROHIBITION - DO NOT REPEAT ANY OF THESE TITLES 🚫🚫🚫:
${previouslyRecommended.join(', ')}

❌ CRITICAL RULE ❌: You are ABSOLUTELY FORBIDDEN from recommending ANY of these titles again, even if they perfectly match the user's preferences.
- These titles have ALREADY been shown to this user in previous sessions
- Recommending them again creates a terrible user experience
- You MUST find completely fresh, NEW recommendations that are NOT in this list
- If you recommend ANY title from this list, it is a CRITICAL ERROR
- There are thousands of other shows/movies available - choose from those instead`;
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
- Age Rating Preference: ${preferences.ageRating || 'No preference'}
- Netflix Region: ${region} 🚨 CRITICAL: Verify ALL recommendations are available in this specific region

Recently Watched Shows:
${watchedShows.length > 0 ? watchedShows.join(', ') : 'None provided'}${ratingHistoryText}${patternAnalysisText}${watchedSignalsText}${excludeText}

Please provide 6 personalized recommendations that match their current state of mind based on how their day is going. Consider their language preferences, whether they're watching alone or with company, and if they want underrated content.${ratingHistory.length > 0 ? '\n\n🎯 CRITICAL INSTRUCTIONS FOR USING ABOVE DATA:\n- Use the DETAILED PREFERENCE ANALYSIS to understand WHY they liked/disliked content\n- Use the STATISTICAL PATTERN ANALYSIS to make data-driven genre and content type choices\n- Use the WATCHED STATUS SIGNALS to prioritize confirmed preferences over uncertain ones\n- Recommendations should reflect these patterns - prioritize "Watched & Loved" patterns most heavily' : ''}`;

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
    console.log('Recommendation response generated', {
      timestamp: new Date().toISOString(),
      hasContent: !!content
    });
    
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
