import { getRedis } from "@/lib/redis";

// Same x-forwarded-for/x-real-ip extraction previously duplicated inline
// in app/api/run - shared here now that more routes need it.
export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const WINDOW_MS = 60 * 60 * 1000;
const FALLBACK_MAX_KEYS = 5000;
const fallbackCounters = new Map(); // key -> { count, resetAt }

function fallbackAllow(key, maxPerHour) {
  const now = Date.now();

  // Keep the map bounded so a flood of unique identifiers can't grow memory
  // without limit: drop expired windows first, then the oldest entries.
  if (fallbackCounters.size >= FALLBACK_MAX_KEYS) {
    for (const [k, v] of fallbackCounters) {
      if (v.resetAt <= now) fallbackCounters.delete(k);
    }
    while (fallbackCounters.size >= FALLBACK_MAX_KEYS) {
      fallbackCounters.delete(fallbackCounters.keys().next().value);
    }
  }

  let entry = fallbackCounters.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    fallbackCounters.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxPerHour;
}

/**
 * Fixed-window rate limit backed by the Vercel/Upstash Redis store,
 * using plain INCR + EXPIRE (works with the standard node-redis client
 * over the TCP connection string Vercel injects).
 *
 * Replaces the old in-memory Map implementation, which reset on every
 * cold start and wasn't shared across serverless instances on Vercel —
 * meaning it did essentially nothing in production.
 *
 * Note: this is a fixed window (not sliding), so a client could in
 * theory get ~2x maxPerHour requests across a window boundary. Good
 * enough for abuse/cost protection; say the word if you want a true
 * sliding window instead.
 *
 * If Redis isn't configured (in production) or errors, this degrades to an
 * in-process counter instead of allowing everything through. That fallback
 * is per serverless instance, so it's weaker than the shared Redis limit
 * (each warm instance keeps its own count and a cold start resets it) - but
 * it still bounds a single client hammering one instance, which is what
 * matters for brute-forcing and cost abuse. It never blocks legitimate
 * traffic because Redis is down. Failures are logged so they're visible.
 * Outside production with no Redis (local dev) requests are simply allowed.
 *
 * @param {string} identifier - usually an IP address
 * @param {number} maxPerHour - requests allowed per rolling hour
 * @returns {Promise<boolean>} true if the request should be allowed
 */
export async function rateLimit(identifier, maxPerHour = 20) {
  const key = `helixon:ratelimit:${maxPerHour}:${identifier || "unknown"}`;

  const redisPromise = getRedis();
  if (!redisPromise) {
    if (process.env.NODE_ENV !== "production") return true;
    console.error("[ratelimit] Redis is not configured in production - using in-memory fallback.");
    return fallbackAllow(key, maxPerHour);
  }

  try {
    const redis = await redisPromise;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60 * 60); // 1 hour window
    }

    return count <= maxPerHour;
  } catch (err) {
    console.error("[ratelimit] Redis error, using in-memory fallback:", err.message);
    return fallbackAllow(key, maxPerHour);
  }
}
