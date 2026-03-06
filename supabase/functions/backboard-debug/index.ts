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

  // List assistants
  const res = await fetch(`${BASE_URL}/assistants`, {
    headers: { 'X-API-Key': BACKBOARD_API_KEY! },
  });

  const text = await res.text();
  console.log('List assistants response:', res.status, text);

  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
