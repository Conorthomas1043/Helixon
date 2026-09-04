// ── Admin CSRF protection (double-submit cookie) ────────────────────────────
// The admin session itself is a signed, httpOnly cookie, which stops it being
// read or stolen by JS - but httpOnly cookies are still sent automatically by
// the browser on cross-site requests, which is exactly what makes CSRF
// possible: a malicious page can make the admin's browser fire a POST/PATCH/
// DELETE to /api/admin/* and the session cookie rides along for free, no
// attacker access to the cookie required.
//
// Fix: issue a second, non-httpOnly, random token alongside the session
// cookie. Client JS reads it and echoes it back as a header on every
// mutating request. A cross-site attacker can trigger the request but can't
// read the cookie (browsers don't allow cross-origin reads) to put it in the
// header, so the two values won't match and the request is rejected. This is
// the standard "double-submit cookie" pattern - no server-side token storage
// needed, works fine alongside the existing signed session cookie.

import crypto from "crypto";
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from "@/lib/admin-csrf-constants";

export { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER };

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Constant-time comparison so a mismatched token can't be brute-forced via
// response-timing differences.
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Verifies the double-submit pair for a mutating request. Returns true/false,
// never throws - callers should treat false as "reject with 403".
export function verifyCsrf(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_CSRF_COOKIE}=`));

  if (!cookieMatch) return false;

  const cookieToken = decodeURIComponent(cookieMatch.split("=").slice(1).join("="));
  const headerToken = request.headers.get(ADMIN_CSRF_HEADER) || "";

  if (!cookieToken || !headerToken) return false;

  return timingSafeEqualStr(cookieToken, headerToken);
}

// Shared 403 body/shape so every route rejects CSRF failures identically.
export const CSRF_REJECTION = { error: "Invalid or missing CSRF token." };
