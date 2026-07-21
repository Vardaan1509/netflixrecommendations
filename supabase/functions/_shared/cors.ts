/**
 * Shared CORS helper for all edge functions.
 *
 * Locks `Access-Control-Allow-Origin` to an allowlist instead of "*", so a
 * random third-party site can't call these endpoints from a user's browser.
 *
 * Configure allowed origins with the ALLOWED_ORIGINS secret (comma-separated),
 * e.g. `https://yourapp.com,https://www.yourapp.com`. If unset, falls back to
 * common local-dev origins so development keeps working out of the box.
 *
 * Note: CORS only constrains browsers — it is not a substitute for auth or
 * rate limiting (a raw script can spoof the Origin header). It's one layer.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
];

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version";

function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Build per-request CORS headers. Echoes the caller's Origin only when it's on
 * the allowlist; otherwise returns the first allowed origin so a disallowed
 * browser gets an origin mismatch and the response is blocked client-side.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowlist = allowedOrigins();
  const allowOrigin =
    origin && allowlist.includes(origin) ? origin : allowlist[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
