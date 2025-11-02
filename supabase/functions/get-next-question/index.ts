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
    const { conversationHistory } = await req.json();
    console.log('Analyzing conversation:', conversationHistory);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an intelligent Netflix recommendation questionnaire. Your job is to determine the next question to ask or decide if you have enough information to make confident recommendations.

Analyze the conversation history and decide:
1. If answers seem confused/inconsistent, ask a clarifying question or suggest trying again
2. If you have enough diverse, coherent information (typically 4-6 good answers), set ready=true
3. Otherwise, ask the most relevant next question based on what you know

Available question types:
- Mood/Day quality
- Genres (checkbox, multiple selection)
- Watch time available
- Watch style (background, focused, nostalgic, etc.)
- Language/subtitles preference
- Watching alone or with company
- Interest in underrated content

Return JSON in this exact format:
{
  "ready": false,
  "needsClarification": false,
  "message": "optional message if needsClarification is true",
  "nextQuestion": {
    "id": "unique_id",
    "question": "Question text",
    "type": "radio" or "checkbox",
    "options": ["option1", "option2", ...]
  },
  "preferences": {} // only if ready=true, extract all gathered preferences
}

If answers seem disinterested or confused, set needsClarification=true and provide a friendly message offering to start fresh or recommend classics.`;

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
    const content = data.choices[0].message.content;
    console.log('AI Response:', content);
    
    const result = JSON.parse(content);

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
