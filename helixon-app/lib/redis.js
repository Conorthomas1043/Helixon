import { createClient } from "redis";

/**
 * Cached, connected node-redis client for the Vercel-provisioned Redis
 * store (standard Redis wire protocol, not the REST API).
 *
 * Cached on `globalThis` so a warm serverless instance reuses the same
 * connection across invocations instead of reconnecting every request.
 * Returns null if no connection string is configured (e.g. local dev
 * without a linked store) so callers can fail open.
 */
export function getRedis() {
  const url =
    process.env.UPSTASH_REDIS_REDIS_URL ||
    process.env.REDIS_URL;

  if (!url) return null;

  if (!globalThis.__helixonRedisClientPromise) {
    const client = createClient({ url });
    client.on("error", (err) => {
      console.error("[redis] client error:", err.message);
    });
    globalThis.__helixonRedisClientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        // Reset so the next call retries instead of reusing a dead promise
        globalThis.__helixonRedisClientPromise = null;
        throw err;
      });
  }

  return globalThis.__helixonRedisClientPromise;
}
