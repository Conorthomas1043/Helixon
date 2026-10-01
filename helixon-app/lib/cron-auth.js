// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Fails closed: no
// secret configured means every request is refused.

import crypto from "crypto";

export function cronAuthorized(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
