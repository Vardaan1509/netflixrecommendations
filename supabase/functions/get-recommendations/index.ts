import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders as buildCorsHeaders } from "../_shared/cors.ts";
import { rateLimit, callerId } from "../_shared/redis.ts";
import { discoverNetflix, TmdbCandidate, MediaType } from "../_shared/tmdb.ts";

// ── Input validation ────────────────────────────────────────────────
const preferencesSchema = z.object({
  mood: z.string().max(100),
  contentType: z.string().max(50).optional(),
  watchTime: z.string().max(100),
  genres: z.array(z.string().max(50)).max(20),
  company: z.string().max(100),
  watchStyle: z.string().max(100),
  language: z.string().max(100),
  underrated: z.string().max(100).optional(),
  ageRating: z.string().max(100).optional(),
});

const recommendationsRequestSchema = z.object({
  preferences: preferencesSchema,
  watchedShows: z.array(z.string().max(200)).max(100),
  region: z.string().max(100),
});

type RatingRow = {
  title: string;
  type: string;
  genre: string;
  user_rating: number;
  watched: boolean | null;
  match_reason: string;
};

// ── Taste profile from rating history ───────────────────────────────
// Compact signal for ranking + the LLM: which genres the user loves/dislikes
// and whether they lean toward series or movies.
function buildTasteProfile(history: RatingRow[]) {
  const lovedGenres = new Set<string>();
  const dislikedGenres = new Set<string>();
  let series = 0;
  let movies = 0;

  for (const r of history) {
    const g = r.genre?.toLowerCase();
    if (r.user_rating >= 4 && g) lovedGenres.add(g);
    if (r.user_rating <= 2 && g) dislikedGenres.add(g);
    if (r.type?.toLowerCase().includes("series")) series += r.user_rating;
    else movies += r.user_rating;
  }

  const lean =
    Math.abs(series - movies) < 3 ? "no strong lean" : series > movies ? "prefers series" : "prefers movies";

  return { lovedGenres, dislikedGenres, lean };
}

// ── Heuristic candidate scoring ─────────────────────────────────────
// Cheap, deterministic pre-rank so we hand the LLM a strong shortlist rather
// than the whole catalog. TMDB rating is the base; genre affinity adjusts it.
function scoreCandidate(
  c: TmdbCandidate,
  prefGenres: Set<string>,
  lovedGenres: Set<string>,
  dislikedGenres: Set<string>,
): number {
  let score = c.rating; // 0-10 base
  score += Math.min(c.popularity / 500, 2); // small popularity nudge, capped

  const genresLower = c.genres.map((g) => g.toLowerCase());
  const hits = (set: Set<string>) =>
    genresLower.some((g) => [...set].some((s) => g.includes(s) || s.includes(g)));

  if (hits(prefGenres)) score += 3;
  if (hits(lovedGenres)) score += 2;
  if (hits(dislikedGenres)) score -= 4;

  return score;
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase();
}

function mediaTypesFor(contentType?: string): MediaType[] {
  const c = (contentType ?? "").toLowerCase();
  const wantsMovie = /movie|film/.test(c);
  const wantsSeries = /series|show|tv/.test(c);
  if (wantsMovie && !wantsSeries) return ["movie"];
  if (wantsSeries && !wantsMovie) return ["tv"];
  return ["movie", "tv"];
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit BEFORE any expensive work.
    const rl = await rateLimit(callerId(req), 20, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.resetSeconds) },
        },
      );
    }

    const body = await req.json();
    const validation = recommendationsRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validation.error.format() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { preferences, watchedShows, region } = validation.data;
    console.log("Recommendation request", {
      timestamp: new Date().toISOString(),
      region,
      watchedCount: watchedShows.length,
      genres: preferences.genres,
    });

    // ── 1. User context (rating history + past recs to exclude) ──────
    let ratingHistory: RatingRow[] = [];
    let previouslyRecommended: string[] = [];

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) {
          const [{ data: allRecs }, { data: ratedRecs }] = await Promise.all([
            supabaseClient.from("recommendations").select("title").eq("user_id", user.id),
            supabaseClient
              .from("recommendations")
              .select("title, type, genre, user_rating, watched, match_reason")
              .eq("user_id", user.id)
              .not("user_rating", "is", null)
              .order("created_at", { ascending: false })
              .limit(30),
          ]);
          previouslyRecommended = (allRecs ?? []).map((r) => r.title);
          ratingHistory = (ratedRecs ?? []) as RatingRow[];
        }
      } catch (err) {
        console.log("Could not fetch user history:", err);
      }
    }

    // ── 2. Retrieve real candidates from the Netflix-in-region catalog ─
    const taste = buildTasteProfile(ratingHistory);
    const genresToQuery = [...new Set([...preferences.genres, ...taste.lovedGenres])];
    const mediaTypes = mediaTypesFor(preferences.contentType);

    const pulls: Promise<TmdbCandidate[]>[] = [];
    for (const mediaType of mediaTypes) {
      // Genre-targeted pages for relevance...
      pulls.push(discoverNetflix({ regionName: region, genreNames: genresToQuery, mediaType, page: 1 }));
      pulls.push(discoverNetflix({ regionName: region, genreNames: genresToQuery, mediaType, page: 2 }));
      // ...plus a broad popular page so we always have depth even if genres are narrow.
      pulls.push(discoverNetflix({ regionName: region, genreNames: [], mediaType, page: 1 }));
    }
    const pulled = (await Promise.all(pulls)).flat();

    // Dedupe by title.
    const byTitle = new Map<string, TmdbCandidate>();
    for (const c of pulled) {
      if (c.title && c.overview) byTitle.set(normalizeTitle(c.title), c);
    }

    // Exclude what they've watched or already been shown.
    const exclude = new Set([...watchedShows, ...previouslyRecommended].map(normalizeTitle));
    const prefGenres = new Set(preferences.genres.map((g) => g.toLowerCase()));

    const shortlist = [...byTitle.values()]
      .filter((c) => !exclude.has(normalizeTitle(c.title)))
      .map((c) => ({ c, score: scoreCandidate(c, prefGenres, taste.lovedGenres, taste.dislikedGenres) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .map((x) => x.c);

    if (shortlist.length === 0) {
      // Only happens if TMDB is unreachable or the region has no Netflix data.
      console.error("No candidates after retrieval/exclusion");
      return new Response(
        JSON.stringify({ error: "Could not reach the catalog right now. Please try again shortly." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. LLM finalize: pick the best 6 from REAL candidates + explain ─
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
    const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-3-flash-preview";

    const shortlistText = shortlist
      .map(
        (c, i) =>
          `${i + 1}. "${c.title}" (${c.year || "n/a"}, ${c.type}) — ${c.genres.join("/") || "n/a"} — TMDB ${c.rating.toFixed(1)}\n   ${c.overview}`,
      )
      .join("\n\n");

    const systemPrompt = `You are a Netflix recommendation assistant.

Every title in the CANDIDATES list is verified available on Netflix in the user's region (${region}) — availability is already handled, so you never need to worry about it.

Your job: pick the 6 BEST matches for the user's preferences and mood, and explain each.

STRICT RULES:
- Choose ONLY from the numbered CANDIDATES. Never invent a title that isn't listed.
- Copy the title, type, genre, and rating EXACTLY as given for each pick.
- Ensure variety: at most 2 picks sharing the same primary genre.
- Write a fresh 2-3 sentence "description" and a 1-sentence "matchReason" tailored to THIS user.

Return JSON exactly:
{
  "recommendations": [
    { "title": "...", "type": "Movie" | "Series", "genre": "...", "description": "...", "matchReason": "...", "rating": "8.4" }
  ]
}`;

    const tasteText =
      ratingHistory.length > 0
        ? `\nTaste signal — loves: ${[...taste.lovedGenres].join(", ") || "n/a"}; dislikes: ${[...taste.dislikedGenres].join(", ") || "n/a"}; ${taste.lean}.`
        : "";

    const userPrompt = `USER PREFERENCES
- Mood: ${preferences.mood}
- Content type: ${preferences.contentType || "both"}
- Genres they want: ${preferences.genres.join(", ")}
- Watch time: ${preferences.watchTime}
- Watch style: ${preferences.watchStyle}
- Language: ${preferences.language}
- Watching with: ${preferences.company}
- Underrated preference: ${preferences.underrated || "no preference"}
- Age rating: ${preferences.ageRating || "no preference"}${tasteText}

CANDIDATES (all available on Netflix ${region}):
${shortlistText}

Pick the 6 best for this user and return the JSON.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://smart-netflix-recommendations.app",
        "X-Title": "Smart Netflix Recommendations",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const rawRecs: Array<Record<string, unknown>> = parsed.recommendations ?? [];

    // ── 4. Enrich with authoritative TMDB data (type/genre/rating) ────
    // The LLM writes the prose; the facts come from the catalog. If the LLM
    // ever drifts off-list, we drop the pick rather than surface a fabrication.
    const recommendations = rawRecs
      .map((rec) => {
        const match = shortlist.find((c) => normalizeTitle(c.title) === normalizeTitle(String(rec.title ?? "")));
        if (!match) {
          console.warn("Dropping off-catalog recommendation:", rec.title);
          return null;
        }
        return {
          title: match.title,
          type: match.type,
          genre: match.genres[0] ?? "Drama",
          description: String(rec.description ?? match.overview),
          matchReason: String(rec.matchReason ?? ""),
          rating: match.rating.toFixed(1),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    console.log("Recommendations generated", {
      timestamp: new Date().toISOString(),
      shortlistSize: shortlist.length,
      returned: recommendations.length,
    });

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-recommendations function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
