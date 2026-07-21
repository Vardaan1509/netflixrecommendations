/**
 * TMDB client — the "real Netflix catalog" source.
 * ---------------------------------------------------------------------------
 * There is no public Netflix API. TMDB's Discover endpoint, powered by its
 * JustWatch partnership, lets us filter titles by streaming provider + region:
 *
 *   with_watch_providers=8   → Netflix (provider id 8)
 *   watch_region=CA          → the user's country (ISO 3166-1)
 *   with_watch_monetization_types=flatrate → subscription (not rent/buy)
 *
 * So a Discover query returns the actual Netflix-in-region catalog, which we
 * use as the candidate pool instead of asking an LLM to remember what's on
 * Netflix. Responses are cached in Redis (the catalog barely changes daily).
 */

import { cacheGet, cacheSet } from "./redis.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const NETFLIX_PROVIDER_ID = 8;
const CATALOG_TTL_SECONDS = 60 * 60 * 24; // 24h — the catalog is stable day-to-day

export type MediaType = "movie" | "tv";

export interface TmdbCandidate {
  title: string;
  overview: string;
  genres: string[]; // human-readable genre names
  rating: number; // TMDB vote_average (0-10)
  popularity: number;
  type: "Movie" | "Series";
  year: string;
}

// App region label → ISO 3166-1 code used by TMDB's watch_region.
const REGION_ISO: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Australia: "AU",
  India: "IN",
  Germany: "DE",
  France: "FR",
  Japan: "JP",
  Brazil: "BR",
  Mexico: "MX",
  Spain: "ES",
  Italy: "IT",
  "South Korea": "KR",
  Netherlands: "NL",
  Sweden: "SE",
};

// TMDB genre id → name (union of movie + tv genre lists).
const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

// Fuzzy map of a free-text genre label → { movie id, tv id }. The questionnaire's
// genres are LLM-generated strings, so we normalize and match on keywords.
// null on a side means "no clean equivalent for that media type".
const GENRE_KEYWORDS: Array<{ match: RegExp; movie: number | null; tv: number | null }> = [
  { match: /action|adventure/, movie: 28, tv: 10759 },
  { match: /anim|anime|cartoon/, movie: 16, tv: 16 },
  { match: /comed|sitcom|funny/, movie: 35, tv: 35 },
  { match: /crime|heist|gangster/, movie: 80, tv: 80 },
  { match: /document|docu|true story/, movie: 99, tv: 99 },
  { match: /drama/, movie: 18, tv: 18 },
  { match: /family|kids|children/, movie: 10751, tv: 10762 },
  { match: /fantasy/, movie: 14, tv: 10765 },
  { match: /history|historical|period/, movie: 36, tv: 18 },
  { match: /horror|scary|slasher/, movie: 27, tv: 9648 },
  { match: /music|musical/, movie: 10402, tv: null },
  { match: /myster|whodunit|detective/, movie: 9648, tv: 9648 },
  { match: /romance|romantic|rom.?com/, movie: 10749, tv: 18 },
  { match: /sci.?fi|science fiction|space|dystop/, movie: 878, tv: 10765 },
  { match: /thriller|suspense|psychological/, movie: 53, tv: 9648 },
  { match: /war|military/, movie: 10752, tv: 10768 },
  { match: /western/, movie: 37, tv: 37 },
  { match: /reality/, movie: null, tv: 10764 },
];

/** Map free-text genre labels to TMDB genre ids for a given media type. */
function mapGenres(genreNames: string[], mediaType: MediaType): number[] {
  const ids = new Set<number>();
  for (const raw of genreNames) {
    const label = raw.toLowerCase();
    for (const g of GENRE_KEYWORDS) {
      if (g.match.test(label)) {
        const id = mediaType === "movie" ? g.movie : g.tv;
        if (id) ids.add(id);
      }
    }
  }
  return [...ids];
}

/** Human-readable genre name from a TMDB id (falls back to "Drama"). */
export function genreName(id: number): string {
  return GENRE_NAMES[id] ?? "Drama";
}

/** ISO code for an app region label (falls back to US). */
export function regionIso(regionName: string): string {
  return REGION_ISO[regionName] ?? "US";
}

interface TmdbResult {
  title?: string;
  name?: string;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
}

function toCandidate(r: TmdbResult, mediaType: MediaType): TmdbCandidate {
  const dateStr = mediaType === "movie" ? r.release_date : r.first_air_date;
  return {
    title: (mediaType === "movie" ? r.title : r.name) ?? "",
    overview: r.overview ?? "",
    genres: (r.genre_ids ?? []).map(genreName),
    rating: r.vote_average ?? 0,
    popularity: r.popularity ?? 0,
    type: mediaType === "movie" ? "Movie" : "Series",
    year: dateStr ? dateStr.slice(0, 4) : "",
  };
}

/**
 * Fetch a page of the Netflix-in-region catalog, optionally filtered by genres.
 * Cached in Redis for 24h. Returns [] on any failure (caller degrades).
 */
export async function discoverNetflix(params: {
  regionName: string;
  genreNames: string[];
  mediaType: MediaType;
  page?: number;
}): Promise<TmdbCandidate[]> {
  const token = Deno.env.get("TMDB_ACCESS_TOKEN");
  if (!token) {
    console.error("TMDB_ACCESS_TOKEN is not configured");
    return [];
  }

  const region = regionIso(params.regionName);
  const genreIds = mapGenres(params.genreNames, params.mediaType);
  const page = params.page ?? 1;

  const cacheKey = `tmdb:disc:${params.mediaType}:${region}:${genreIds.sort().join("-") || "all"}:p${page}`;
  const cached = await cacheGet<TmdbCandidate[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${TMDB_BASE}/discover/${params.mediaType}`);
  url.searchParams.set("watch_region", region);
  url.searchParams.set("with_watch_providers", String(NETFLIX_PROVIDER_ID));
  url.searchParams.set("with_watch_monetization_types", "flatrate");
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("vote_count.gte", "50"); // skip obscure long-tail noise
  url.searchParams.set("page", String(page));
  if (genreIds.length) url.searchParams.set("with_genres", genreIds.join("|")); // OR

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    console.error("TMDB discover error:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  const candidates = (data.results ?? []).map((r: TmdbResult) => toCandidate(r, params.mediaType));
  await cacheSet(cacheKey, candidates, CATALOG_TTL_SECONDS);
  return candidates;
}
