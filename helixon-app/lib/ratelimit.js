import { getRedis } from "@/lib/redis";

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
 * Fails open (allows the request) if Redis isn't configured or errors,
 * so a Redis outage doesn't take down the endpoint. Failures are
 * logged so they're visible rather than silent.
 *
 * @param {string} identifier - usually an IP address
 * @param {number} maxPerHour - requests allowed per rolling hour
 * @returns {Promise<boolean>} true if the request should be allowed
 */
export async function rateLimit(identifier, maxPerHour = 20) {
  const redisPromise = getRedis();
  if (!redisPromise) {
    // No Redis configured (e.g. local dev) — allow through.
    return true;
  }

  try {
    const redis = await redisPromise;
    const key = `helixon:ratelimit:${maxPerHour}:${identifier || "unknown"}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60 * 60); // 1 hour window
    }

    return count <= maxPerHour;
  } catch (err) {
    console.error("[ratelimit] Redis error, failing open:", err.message);
    return true;
  }
}
