// Constant-time comparison for secrets (cron/internal bearer tokens, CSRF
// tokens, one-time codes), so response timing can't reveal how much of a
// guess was right. Fails closed: anything that isn't two non-empty strings
// is unequal.

import crypto from "crypto";

export function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
