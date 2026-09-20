import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_ABSOLUTE_TIMEOUT_MS,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { ADMIN_CSRF_COOKIE, generateCsrfToken } from "@/lib/admin-csrf";

// ── Admin session handling ───────────────────────────────────────────────────
// Replaces the old pattern of a USERS map + a hardcoded admin key sitting
// inside client-side JS (admin/page.js). That meant anyone could open the
// browser dev tools, read the JS bundle, and pull out both the admin
// usernames/passwords AND the permanent backend admin key - giving them full
// read access to every agency's candidates, scores, and subscriptions
// forever, with no way to revoke it short of redeploying new code.
//
// This version:
//  - Stores admin credentials as env vars (server-only, never shipped to the browser)
//  - Compares password hashes, not plaintext
//  - Issues a signed, httpOnly, short-lived session cookie instead of a
//    permanent static key the client can read or copy out of localStorage
//
// Token *verification* lives in lib/admin-session.js (Web Crypto, no
// Node-only APIs) rather than here, so proxy.ts - which runs on the Edge
// Runtime and can't import Node's `crypto` module - can check the same
// session cookie before /admin ever renders. Signing (below) stays on
// Node's `crypto` since it only ever runs from the login route.
//
// Required env vars (set these in your hosting provider, e.g. Vercel):
//   ADMIN_USERS               e.g. "Tanaka,Conor"  (comma-separated usernames)
//   ADMIN_PASSWORD_HASH_TANAKA   bcrypt hash (or legacy sha256 hex) of Tanaka's password
//   ADMIN_PASSWORD_HASH_CONOR    bcrypt hash (or legacy sha256 hex) of Conor's password
//   ADMIN_SESSION_SECRET      a long random string (32+ chars) used to sign session cookies
//
// Optional:
//   ADMIN_TOTP_SECRET_<USER>     enables two-factor login for that admin (lib/admin-totp.js)
//   ADMIN_REQUIRE_2FA=true       refuse admins who have no TOTP secret
//   ADMIN_SESSIONS_VALID_AFTER   sign every admin out (lib/admin-session.js)
//   ADMIN_SESSION_VALID_AFTER_<USER>  sign just <USER> out - set this alongside
//                                a rotated ADMIN_PASSWORD_HASH_<USER> so the
//                                old session can't keep being used after a
//                                password change (lib/admin-session.js)
//   ADMIN_LOGIN_SLUG             hide the default /admin/login route (proxy.ts)

const SESSION_COOKIE = ADMIN_SESSION_COOKIE;

function hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET");
  if (secret.length < 32) {
    // Not enforced (that would lock every admin out on deploy if the current
    // secret is short) - but a short HMAC key can be brute-forced offline from
    // a captured cookie, so make it loud. Use 32+ random characters.
    console.error("[admin-auth] ADMIN_SESSION_SECRET is shorter than 32 characters - replace it with a long random value.");
  }
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(data).toString("base64url") + "." + sig;
}

// Looks up the env-stored hash for a username, e.g. ADMIN_PASSWORD_HASH_TANAKA
function expectedHashFor(username) {
  const envKey = `ADMIN_PASSWORD_HASH_${username.toUpperCase()}`;
  return process.env[envKey] || null;
}

function allowedUsernames() {
  return (process.env.ADMIN_USERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

// ── Called by the login API route ────────────────────────────────────────────
// Returns { ok, error } - never throws, so the route can respond cleanly.
//
// ADMIN_PASSWORD_HASH_<USER> may be either:
//   - a bcrypt hash ("$2a$/$2b$/$2y$..."), the preferred format - generate
//     one with `node scripts/hash-admin-password.js`, or
//   - a legacy unsalted sha256 hex digest. Still accepted so existing
//     admins aren't locked out when this deploys; replace them with bcrypt
//     hashes when convenient.
//
// Every failure - unknown user, missing config, wrong password - returns the
// same message, and unknown users still pay for a full bcrypt comparison, so
// neither the response nor its timing reveals which admin usernames exist.
// The real reason is logged server-side only.
const GENERIC_LOGIN_ERROR = "Incorrect username or password.";

// A valid bcrypt hash of a random string, compared against for unknown
// usernames so they cost the same as real ones.
const DUMMY_BCRYPT_HASH = "$2b$12$EcOFc0xxNP4NfQuRkp7itu3fdh3A/NZ5l2Sg7pA/qNlXs0EbIwHyy";

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(value || "");
}

export async function checkAdminCredentials(username, password) {
  const allowed = allowedUsernames();
  const known = allowed.includes(username);
  const expected = known ? expectedHashFor(username) : null;

  if (!known || !expected) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    if (known && !expected) {
      console.error(`[admin-auth] No ADMIN_PASSWORD_HASH_${username.toUpperCase()} configured for allowed admin "${username}".`);
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  let matches;
  if (isBcryptHash(expected)) {
    matches = await bcrypt.compare(password, expected);
  } else {
    const actual = hash(password);
    matches =
      actual.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }

  return matches ? { ok: true } : { ok: false, error: GENERIC_LOGIN_ERROR };
}

// ── Issues the session cookie after a successful login ───────────────────────
function cookieOptions(maxAgeMs, httpOnly) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.floor(maxAgeMs / 1000)),
  };
}

// The session token records when it was issued (iat, used by the
// ADMIN_SESSIONS_VALID_AFTER kill switch), when it goes idle (exp - slides
// forward with activity, see getAdminSession) and its hard limit (max).
export async function createAdminSession(username) {
  const now = Date.now();
  const token = sign({
    username,
    iat: now,
    exp: now + ADMIN_IDLE_TIMEOUT_MS,
    max: now + ADMIN_ABSOLUTE_TIMEOUT_MS,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(ADMIN_IDLE_TIMEOUT_MS, true));

  // CSRF token cookie - deliberately NOT httpOnly, since client JS needs to
  // read it and echo it back as a header on every mutating fetch (see
  // lib/admin-csrf.js for why this defeats CSRF despite being readable).
  // It lives for the session's full possible length so it never expires
  // before the session cookie it protects.
  cookieStore.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), cookieOptions(ADMIN_ABSOLUTE_TIMEOUT_MS, false));
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ADMIN_CSRF_COOKIE);
}

// ── Reads the current admin session, if any ──────────────────────────────────
// Returns { username, expiresAt, absoluteExpiresAt } or null.
//
// Unless { refresh: false } is passed, using the console counts as activity:
// the idle expiry is pushed 30 minutes out again (never past the 8-hour hard
// limit) by re-issuing the cookie. That needs a Route Handler or Server Action
// - in a Server Component the cookie can't be written, so the refresh is
// skipped there and the session simply isn't extended by that render.
export async function getAdminSession({ refresh = true } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAdminSessionToken(token);
  if (!payload) return null;

  let expiresAt = payload.exp;

  // Tokens issued before the sliding session existed have no hard limit (max);
  // they are left alone and run out at their original expiry.
  if (refresh && payload.max) {
    const now = Date.now();
    const slid = Math.min(now + ADMIN_IDLE_TIMEOUT_MS, payload.max);
    // Only re-issue when it buys at least a minute, so a burst of API calls
    // doesn't send a Set-Cookie header on every one of them.
    if (slid - payload.exp > 60_000) {
      try {
        const renewed = sign({
          username: payload.username,
          iat: payload.iat ?? now,
          exp: slid,
          max: payload.max,
        });
        cookieStore.set(SESSION_COOKIE, renewed, cookieOptions(slid - now, true));
        expiresAt = slid;
      } catch {
        // Not in a context that can set cookies - leave the session as it is.
      }
    }
  }

  return {
    username: payload.username,
    expiresAt,
    absoluteExpiresAt: payload.max || payload.exp,
  };
}

// ── Guard for admin-only API routes ───────────────────────────────────────────
// Reads the session the same way getAdminSession does, but throws if there
// isn't a valid one. Lets a route do:
//
//   try {
//     const session = await requireAdminSession();
//   } catch (err) {
//     return NextResponse.json({ error: err.message }, { status: 401 });
//   }
//
// instead of repeating the null-check + 401 response in every handler.
export async function requireAdminSession(options) {
  const session = await getAdminSession(options);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

// True when the hidden-admin setup is active (ADMIN_LOGIN_SLUG set; see
// proxy.ts). Used to decide where to send someone after they log out.
export function isAdminRouteHidden() {
  const slug = (process.env.ADMIN_LOGIN_SLUG || "").replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9_-]{8,}$/.test(slug);
}

// (isAdminUser(request) used to live here - a second, hand-rolled cookie
// parser that let other routes grant admin perks such as bypassing the
// paywall. Nothing called it, and an unused "am I admin" shortcut is a
// liability, so it was removed.)