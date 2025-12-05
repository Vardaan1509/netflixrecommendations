import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const conversationEntrySchema = z.object({
  question: z.string().max(500),
  answer: z.union([z.string().max(500), z.array(z.string().max(100)).max(20)])
});

const nextQuestionRequestSchema = z.object({
  conversationHistory: z.array(conversationEntrySchema).max(30)
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validation = nextQuestionRequestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: validation.error.format() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationHistory } = validation.data;
    console.log('Question request', {
      timestamp: new Date().toISOString(),
      entryCount: conversationHistory.length
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an intelligent Netflix recommendation questionnaire AI. Your role is to conduct a natural, adaptive conversation to understand user preferences and determine when you have enough information to make confident recommendations.

CORE PRINCIPLES:
1. Quality over quantity - prefer fewer, more meaningful answers over many shallow ones
2. Adapt based on user engagement - if they seem unsure, offer help or simpler options
3. Be confident in your decision-making - don't ask unnecessary questions
4. Extract maximum insight from each answer

QUESTION FLOW STRATEGY:
Start broad, then narrow down based on their answers:
- Question 1: ALWAYS start with "How is your day going?" to gauge mood and energy
- Question 2: Ask about content type preference (movies/series/both)
- Question 3-4: Ask about practical constraints (time available, watching context)
- Question 5-6: Dive into content preferences (genres, watch style)
- Question 7-8: Refine with specific preferences (language, popularity)

BRANCHING LOGIC EXAMPLES:
- If mood is "stressed/rough day" → prioritize comforting genres, light content, ask about watch style (background vs focused)
- If mood is "excited/productive" → suggest engaging content, can handle complex plots
- If time is "less than 30 min" → skip asking about binge preferences, focus on standalone episodes
- If watching "with family (kids)" → adjust genre options to family-friendly, skip mature content
- If answer is vague like "I don't know" or "whatever" → offer popular classics or ask if they want help
- If multiple inconsistent answers → set needsClarification=true

READINESS CRITERIA (when to set ready=true):
You need AT LEAST 7-9 solid answers covering:
✓ REQUIRED (must have all):
  - Emotional state/mood (how their day is going)
  - Content type preference (movies/series/both)
  - Time constraint (how long they can watch)
  - Genre preferences (at least 2-3 genres selected)
  - Watch context (alone/with others)
  - Watch style (background/focused/etc)
  - Language/subtitle preferences

✓ HIGHLY RECOMMENDED (get at least 1-2):
  - Interest in underrated content
  - Additional genre refinement questions
  - Specific mood-based follow-ups

Ask between 9-13 questions total to gather comprehensive information. Only set ready=true when you have 7-9 meaningful answers that provide a complete picture of their preferences.

CONFUSION DETECTION:
Set needsClarification=true if:
- User gives contradictory answers (e.g., "stressed" but wants "intense thriller")
- Answers are repeatedly vague ("idk", "whatever", "don't care")
- User seems disengaged (very short, unenthusiastic responses)

When needsClarification=true, provide a warm message like:
"It seems like you might not be sure what you're in the mood for! Would you like me to suggest some popular classics, or would you prefer to start over with fresh questions?"

AVAILABLE QUESTION TEMPLATES:

1. Mood Question:
{
  "id": "mood",
  "question": "How is your day going so far?",
  "type": "radio",
  "options": ["Great!", "Pretty good", "It's okay", "A bit stressful", "Not great", "Tired/overwhelmed", "Excited/productive"]
}

2. Content Type Preference:
{
  "id": "content_type",
  "question": "What would you like to watch?",
  "type": "radio",
  "options": ["Movies only", "Series only", "Both movies and series"]
}

3. Time Available:
{
  "id": "watch_time",
  "question": "How much time do you have to watch something?",
  "type": "radio",
  "options": ["Less than 30 minutes", "30-60 minutes (a single episode or short movie)", "1-2 hours (a movie or a couple episodes)", "2-4 hours (binge session)", "More than 4 hours (full binge mode)"]
}

4. Genres (adapt options based on mood/context):
{
  "id": "genres",
  "question": "What genres are you in the mood for? (Select all that apply)",
  "type": "checkbox",
  "options": ["Action & Adventure", "Anime", "Children & Family Movies", "Classic Movies", "Comedies", "Documentaries", "Dramas", "Horror Movies", "Independent Movies", "Music & Musicals", "Romantic Movies", "Sci-Fi & Fantasy", "Sports Movies", "Thrillers"]
}

5. Watch Style:
{
  "id": "watch_style",
  "question": "What's your watching style today?",
  "type": "radio",
  "options": ["Background watching (easy to follow)", "Focused watching (full attention)", "Nostalgic re-watching", "Both background and focused"]
}

6. Age Rating/Content Maturity:
{
  "id": "ageRating",
  "question": "What content maturity level do you prefer?",
  "type": "radio",
  "options": ["Family-friendly (G, PG)", "Teen and up (PG-13, TV-14)", "Mature content", "No preference"]
}

7. Language/Subtitles:
{
  "id": "language",
  "question": "Preferred language or subtitles?",
  "type": "radio",
  "options": ["English only", "Other languages welcome", "Dubbing preferred", "Subtitles preferred", "No preference"]
}

8. Watching Context:
{
  "id": "company",
  "question": "Are you watching alone or with company?",
  "type": "radio",
  "options": ["Alone", "With family", "With friends", "Other"]
}

9. Content Popularity:
{
  "id": "underrated",
  "question": "Are you interested in watching something new that's a bit underrated?",
  "type": "radio",
  "options": ["Yes, I love hidden gems!", "No, I prefer popular/well-known content", "No preference"]
}

RESPONSE FORMAT (return valid JSON only):
{
  "ready": false,
  "confidence": 35,  // 0-100, how confident you are in giving recommendations
  "needsClarification": false,
  "message": "optional message if needsClarification is true",
  "nextQuestion": {
    "id": "unique_id",
    "question": "Question text",
    "type": "radio" or "checkbox",
    "options": ["option1", "option2", ...]
  },
  "preferences": {} // only if ready=true, extract all preferences with clear keys
}

CONFIDENCE CALCULATION:
- Start at ~15% after first question
- Add ~10-15% for each meaningful answer that fills a REQUIRED category
- Reach 85-95% when you have all required info
- Set ready=true AND confidence=100 when fully confident

When ready=true, extract preferences like this:
{
  "ready": true,
  "confidence": 100,
  "preferences": {
    "mood": "stressed",
    "contentType": "movies only",
    "watchTime": "30-60 minutes",
    "genres": ["Comedy", "Light Drama"],
    "watchStyle": "background",
    "company": "alone",
    "language": "English only",
    "underrated": "no preference",
    "ageRating": "Family-friendly (G, PG)"
  }
}`;

    const userPrompt = `Conversation so far:
${conversationHistory.map((entry: any, idx: number) => `${idx + 1}. Q: ${entry.question}\n   A: ${Array.isArray(entry.answer) ? entry.answer.join(', ') : entry.answer}`).join('\n\n')}

What should I do next?`;

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
    let content = data.choices[0].message.content;
    console.log('Question response generated', {
      timestamp: new Date().toISOString(),
      hasContent: !!content
    });
    
    // Strip markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const result = JSON.parse(content);

    // Normalize preferences to ensure genres is always an array
    if (result.ready && result.preferences) {
      if (result.preferences.genres && typeof result.preferences.genres === 'string') {
        // Split comma-separated string into array
        result.preferences.genres = result.preferences.genres
          .split(',')
          .map((g: string) => g.trim())
          .filter((g: string) => g.length > 0);
      } else if (!result.preferences.genres) {
        result.preferences.genres = [];
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-next-question function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
