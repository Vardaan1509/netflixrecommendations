# 🎬 Smart Netflix Recommendations

An AI-powered web app that kills "scroll fatigue." Tell it your mood and preferences (or just chat with it), and it returns personalized, **region-aware** picks that are **actually available on your Netflix** — pulled from a real catalog, not guessed by a language model.

There are two ways to get recommendations:

- **Questionnaire mode** — an adaptive, AI-driven Q&A that decides its own next question, then generates picks from the real Netflix catalog for your region.
- **Ask Your Assistant (memory chat)** — a conversational assistant backed by a persistent, per-user memory that learns your taste across sessions.

Signed-in users get a feedback loop: rating shows sharpens future recommendations and feeds the assistant's memory.

---

## 🚀 Features

- **Real availability, not hallucinated.** Candidates come from the live Netflix-in-region catalog via TMDB's JustWatch-powered data, so you're never recommended something you can't stream.
- **Two recommendation engines** — adaptive questionnaire and a memory-powered chat assistant.
- **Region-aware** — pick your Netflix region; results are filtered to what's available there.
- **Learns from you** — rate a title (love it / not for me / watched / hide) and it refines future picks and remembers across sessions.
- **Streaming-style chat UI** — word-by-word reveal, an animated assistant orb, and quick-start prompts.
- **Hardened & rate-limited backend** — CORS allowlist, request validation, per-user vector scoping, and Redis-based rate limiting to protect API budgets.
- **Responsive, restrained UI** — React + Tailwind + shadcn/ui, Inter typography, dark slate theme.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query |
| Auth / DB | Supabase (Postgres + Row Level Security + Auth) |
| Serverless | Supabase Edge Functions (Deno) |
| LLM | OpenRouter (default `google/gemini-3-flash-preview`, configurable) |
| Catalog & availability | TMDB (Discover + watch-providers, Netflix by region) |
| Memory assistant | Backboard (persistent per-user memory threads) |
| Cache & rate limiting | Upstash Redis (HTTP/serverless) |
| Embeddings | `openai/text-embedding-3-small` via OpenRouter (stored for future re-ranking) |
| Hosting | Netlify (frontend) + Supabase (backend) |

---

## 📋 Architecture

### Recommendation pipeline (questionnaire mode)

The engine does **not** ask the LLM to remember what's on Netflix. Instead:

1. **Retrieve** — query the real Netflix-in-region catalog from TMDB (`with_watch_providers=8` + `watch_region`), filtered by the user's genres and content type.
2. **Exclude** — drop titles the user has watched or already been shown.
3. **Re-rank** — a cheap, deterministic heuristic scores candidates by TMDB rating + genre affinity from the user's rating history.
4. **Finalize** — the LLM picks the best 6 from the *real* shortlist and writes the descriptions/explanations. Any pick that isn't on the shortlist is dropped, so the model can't fabricate a title or its availability.
5. **Enrich** — title, type, genre, and rating are re-attached from TMDB (authoritative), not the LLM.

TMDB catalog responses are cached in Redis (24h TTL) to cut latency and API calls.

### Memory chat (assistant mode)

Messages go to the user's persistent **Backboard** thread with auto memory. Feedback (ratings, "loved", "watched", "not interested") is pushed into that thread as natural-language notes, so the assistant genuinely remembers your taste over time.

### Edge Functions

| Function | Purpose | Auth |
|---|---|---|
| `get-next-question` | Drives the adaptive questionnaire | Rate-limited |
| `get-recommendations` | Catalog retrieval → rank → LLM finalize | Rate-limited |
| `generate-embedding` | Stores 4–5★ show embeddings (for future re-ranking) | JWT required |
| `backboard-recommend` | Memory-powered chat recommendations | Rate-limited + in-code auth |
| `backboard-feedback` | Pushes rating/feedback into the memory thread | In-code auth |

Shared code lives in `supabase/functions/_shared/` (`cors.ts`, `redis.ts`, `tmdb.ts`).

### Security posture

- **CORS allowlist** — origins configured via `ALLOWED_ORIGINS` (no wildcard `*`).
- **Request validation** — every function validates its body with Zod.
- **Row Level Security** — all tables are per-user isolated; the vector-similarity function is scoped to `auth.uid()`.
- **Rate limiting** — Upstash Redis fixed-window limiter (20 req/min per caller) in front of the LLM endpoints, fails open if Redis is unavailable.
- **Input moderation** — client + server checks for length, prompt-injection patterns, and profanity on the chat.

### Data model (Postgres)

- `profiles` — one per user; holds the Backboard thread id.
- `watched_shows` — titles the user has seen.
- `recommendations` — every rec shown, plus `user_rating` and `watched` for the learning loop.
- `show_embeddings` — pgvector(1536) embeddings of 4–5★ titles (retained for future re-ranking).

Full schema: `supabase/schema.sql`.

---

## ⚙️ Setup

### 1. Clone & install
```bash
git clone https://github.com/Vardaan1509/netflixrecommendations.git
cd netflixrecommendations
npm install
```

### 2. Frontend environment
Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```
> The key name must be `VITE_SUPABASE_PUBLISHABLE_KEY` — that's what `src/integrations/supabase/client.ts` reads.

### 3. Database
In the Supabase SQL Editor, run `supabase/schema.sql` (creates tables, RLS policies, triggers, and the pgvector function). Idempotent — safe to re-run.

### 4. Edge Function secrets
Set these in Supabase (dashboard → Edge Functions → Secrets, or via CLI). They are **server-side only** — never put them in the frontend `.env`:
```bash
supabase secrets set \
  OPENROUTER_API_KEY=...  OPENROUTER_MODEL=google/gemini-3-flash-preview \
  TMDB_ACCESS_TOKEN=... \
  BACKBOARD_API_KEY=...  BACKBOARD_ASSISTANT_ID=... \
  UPSTASH_REDIS_REST_URL=...  UPSTASH_REDIS_REST_TOKEN=... \
  ALLOWED_ORIGINS=https://your-production-domain,http://localhost:8080
```

| Secret | Used for |
|---|---|
| `OPENROUTER_API_KEY` | LLM calls + embeddings (one key covers both) |
| `OPENROUTER_MODEL` | (optional) chat model slug; defaults to `google/gemini-3-flash-preview` |
| `TMDB_ACCESS_TOKEN` | Netflix catalog + availability + metadata |
| `BACKBOARD_API_KEY` / `BACKBOARD_ASSISTANT_ID` | Memory-powered chat |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Caching + rate limiting |
| `ALLOWED_ORIGINS` | CORS allowlist (comma-separated) |

### 5. Deploy functions
```bash
supabase functions deploy get-next-question
supabase functions deploy get-recommendations
supabase functions deploy generate-embedding
supabase functions deploy backboard-recommend
supabase functions deploy backboard-feedback
```

### 6. Run locally
```bash
npm run dev   # http://localhost:8080
```

---

## 🚢 Deployment

- **Frontend:** Netlify — connect the repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, deploy.
- **Backend:** Supabase — schema applied, functions deployed, secrets set.
- **Auth:** in Supabase → Authentication → URL Configuration, set the Site URL and Redirect URLs to your production domain.
- **CORS:** include the production domain in `ALLOWED_ORIGINS`.

---

## 🌟 About the Developer
Developed by **Vardaan Mehandiratta**, a Computer Engineering student at the University of Waterloo. This project showcases full-stack development, AI integration, retrieval + re-ranking pipelines, and production hardening (auth, rate limiting, caching).
