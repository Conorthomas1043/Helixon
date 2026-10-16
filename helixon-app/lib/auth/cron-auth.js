// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Fails closed: no
// secret configured means every request is refused.

import "server-only";
import crypto from "crypto";
import { reportError } from "@/lib/report-error";

export function cronAuthorized(request) {
  const expected = process.env.CRON_SECRET;
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected) {
    reportError(`[cron] CRON_SECRET is not set - refusing ${new URL(request.url).pathname}. Scheduled jobs (data retention among them) don't run until it is.`);
    return false;
  }
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
