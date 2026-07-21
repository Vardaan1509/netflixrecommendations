/**
 * Shared Redis (Upstash) helper for the edge functions.
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 *   Upstash is Redis exposed over HTTPS. Every command below (INCR, EXPIRE)
 *   is really a small HTTPS request to your Upstash database. That's why it
 *   works inside serverless edge functions, which can't hold the raw TCP
 *   socket a normal Redis client needs.
 *
 * WHAT IT DOES HERE
 *   Provides a fixed-window rate limiter: "allow at most N requests per user
 *   per time window." Used to stop anyone from hammering the LLM endpoints
 *   and draining the OpenRouter budget.
 *
 * DESIGN RULE — FAIL OPEN
 *   Redis is a guard, not a hard dependency. If the two Upstash secrets are
 *   missing, or Upstash is unreachable, we ALLOW the request instead of
 *   throwing. A cache/limiter outage should never take the app down.
 */

import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

// Reuse one client across warm invocations instead of rebuilding it each time.
let client: Redis | null = null;

function getRedis(): Redis | null {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null; // not configured → caller fails open
  if (!client) client = new Redis({ url, token });
  return client;
}

export interface RateLimitResult {
  allowed: boolean; // false → the caller should return HTTP 429
  limit: number; // the configured ceiling
  remaining: number; // how many requests are left in this window
  resetSeconds: number; // seconds until the window resets (for Retry-After)
}

/**
 * Fixed-window rate limiter.
 *
 * How the window works, step by step, per request:
 *   1. INCR <key>            → add 1 to this caller's counter, get the new total.
 *                              If the key didn't exist, Redis creates it at 1.
 *   2. if total === 1        → EXPIRE <key> <windowSeconds>. This is the first
 *                              request of a fresh window, so start the countdown.
 *                              After windowSeconds the key auto-deletes and the
 *                              counter resets to 0 on the next request.
 *   3. if total > limit      → over the ceiling → deny (allowed = false).
 *
 * INCR is atomic, so concurrent requests each get a distinct, correct number —
 * no race conditions on the counter.
 *
 * @param identifier stable per-caller string (see callerId below)
 * @param limit      max requests allowed per window (default 20)
 * @param windowSeconds  window length in seconds (default 60)
 */
export async function rateLimit(
  identifier: string,
  limit = 20,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const redis = getRedis();

  // Not configured → don't block anything.
  if (!redis) {
    return { allowed: true, limit, remaining: limit, resetSeconds: windowSeconds };
  }

  const key = `ratelimit:${identifier}`;

  try {
    const total = await redis.incr(key);
    if (total === 1) {
      await redis.expire(key, windowSeconds);
    }
    return {
      allowed: total <= limit,
      limit,
      remaining: Math.max(0, limit - total),
      resetSeconds: windowSeconds,
    };
  } catch (err) {
    // Redis hiccup → fail open, but log it so it's visible in function logs.
    console.error("Rate limit check failed (allowing request):", err);
    return { allowed: true, limit, remaining: limit, resetSeconds: windowSeconds };
  }
}

/**
 * Derive a stable identifier for the caller from the request.
 * Uses the client IP (first hop of x-forwarded-for). Good enough to protect
 * the budget; can be upgraded to a per-user id later if needed.
 */
export function callerId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}
