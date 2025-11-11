import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * STEP 2: Embedding Generation Edge Function
 * 
 * This function generates OpenAI embeddings for shows that users rate highly (4-5 stars).
 * 
 * Flow:
 * 1. Receives: title, description, rating from frontend
 * 2. Validates: Only process 4-5 star ratings
 * 3. Generates: 1536-dimensional vector using OpenAI text-embedding-3-small
 * 4. Stores: Vector in show_embeddings table for future similarity searches
 * 
 * Why embeddings?
 * - Captures semantic meaning of show descriptions
 * - Enables mathematical similarity comparisons (cosine distance)
 * - Much faster than AI processing thousands of shows
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, rating } = await req.json();

    // Validate inputs
    if (!title || !description || !rating) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, description, rating' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only generate embeddings for high ratings (4-5 stars)
    if (rating < 4) {
      return new Response(
        JSON.stringify({ message: 'Embeddings only generated for 4-5 star ratings' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
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

    console.log('Generating embedding for user:', user.id, 'title:', title, 'rating:', rating);

    // Generate embedding using OpenAI API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Create embedding text by combining title and description
    const embeddingText = `${title}: ${description}`;

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // Creates 1536-dimensional vectors
        input: embeddingText,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('OpenAI API error:', embeddingResponse.status, errorText);
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    console.log('Embedding generated successfully, dimensions:', embedding.length);

    // Store embedding in database (upsert to handle duplicates)
    const { error: upsertError } = await supabaseClient
      .from('show_embeddings')
      .upsert(
        {
          user_id: user.id,
          title,
          description,
          embedding,
          user_rating: rating,
        },
        {
          onConflict: 'user_id,title', // Update if already exists
        }
      );

    if (upsertError) {
      console.error('Error storing embedding:', upsertError);
      throw upsertError;
    }

    console.log('Embedding stored successfully for:', title);

    return new Response(
      JSON.stringify({ success: true, message: 'Embedding generated and stored' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-embedding function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
