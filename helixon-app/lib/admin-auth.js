import { cookies } from "next/headers";
import crypto from "crypto";

// ── Admin session handling ───────────────────────────────────────────────────
// Replaces the old pattern of a USERS map + a hardcoded admin key sitting
// inside client-side JS (admin/page.js). That meant anyone could open the
// browser dev tools, read the JS bundle, and pull out both the admin
// usernames/passwords AND the permanent backend admin key — giving them full
// read access to every agency's candidates, scores, and subscriptions
// forever, with no way to revoke it short of redeploying new code.
//
// This version:
//  - Stores admin credentials as env vars (server-only, never shipped to the browser)
//  - Compares password hashes, not plaintext
//  - Issues a signed, httpOnly, short-lived session cookie instead of a
//    permanent static key the client can read or copy out of localStorage
//
// Required env vars (set these in your hosting provider, e.g. Vercel):
//   ADMIN_USERS               e.g. "Tanaka:Conor"  (comma-separated usernames)
//   ADMIN_PASSWORD_HASH_TANAKA   sha256 hex hash of Tanaka's password
//   ADMIN_PASSWORD_HASH_CONOR    sha256 hex hash of Conor's password
//   ADMIN_SESSION_SECRET      a long random string used to sign session cookies
//   ADMIN_KEY                 (already existed) used by /api/admin/stats

const SESSION_COOKIE = "helixon_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET");
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(data).toString("base64url") + "." + sig;
}

function verify(token) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) return null;
    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return null;
    const data = Buffer.from(dataB64, "base64url").toString("utf8");
    const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("hex");
    // Constant-time comparison to avoid timing attacks
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return null;
    }
    const payload = JSON.parse(data);
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
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
// Returns { ok, error } — never throws, so the route can respond cleanly.
export function checkAdminCredentials(username, password) {
  const allowed = allowedUsernames();
  if (!allowed.includes(username)) {
    return { ok: false, error: "Unknown username." };
  }
  const expected = expectedHashFor(username);
  if (!expected) {
    // Misconfiguration — env var missing for an otherwise-allowed username
    return { ok: false, error: "Admin account not configured." };
  }
  const actual = hash(password);
  const matches =
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!matches) {
    return { ok: false, error: "Incorrect password. Try again." };
  }
  return { ok: true };
}

// ── Issues the session cookie after a successful login ───────────────────────
export async function createAdminSession(username) {
  const token = sign({ username, exp: Date.now() + SESSION_TTL_MS });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ── Reads the current admin session, if any ──────────────────────────────────
// Returns { username } or null. Safe to call from any server component or route.
export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  return { username: payload.username };
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
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Used by other API routes (e.g. bulk, run) to grant admin perks ───────────
// like bypassing the free-trial paywall. Reads the same httpOnly cookie via
// the incoming request — works in route handlers that receive `request`.
export async function isAdminUser(request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (!match) return false;
    const token = decodeURIComponent(match.split("=").slice(1).join("="));
    const payload = verify(token);
    return !!payload;
  } catch {
    return false;
  }
}