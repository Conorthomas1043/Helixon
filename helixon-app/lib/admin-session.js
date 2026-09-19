// ── Isomorphic admin session verification ───────────────────────────────────
// Deliberately has NO Node-only imports (no `crypto` module, no `Buffer`) so
// it can be safely imported from two very different places:
//
//   1. lib/admin-auth.js - used by Node.js route handlers / server
//      components (getAdminSession, requireAdminSession, isAdminUser).
//   2. proxy.ts - runs on the Edge Runtime. Edge Runtime does not support
//      Node's built-in `crypto` module; importing it there causes a
//      build-time error ("A Node.js API is used ... not supported in the
//      Edge Runtime"). This is why proxy.ts previously had no way to check
//      the admin session at all and /admin rendered for anyone.
//
// Signing (issuing new session tokens) still happens in lib/admin-auth.js
// using Node's `crypto` - that only ever runs in the login route, a
// Node.js context, so there's no restriction there. This file only
// *re-derives* the same HMAC-SHA256 to check a token that's already been
// issued. Web Crypto (crypto.subtle) computes byte-identical HMAC-SHA256
// output to Node's crypto.createHmac for the same key/data, so a token
// signed by admin-auth.js verifies correctly here, and vice versa.

export const ADMIN_SESSION_COOKIE = "helixon_admin_session";

// A session ends after 30 minutes without activity (the idle expiry slides
// forward each time the admin uses the console - see lib/admin-auth.js), and
// after 8 hours in any case, however active. Both are checked here so the Edge
// proxy and the API routes agree.
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

// Emergency kill switch. Set ADMIN_SESSIONS_VALID_AFTER (an ISO date such as
// 2026-09-19T12:00:00Z, or epoch milliseconds) in the environment and redeploy:
// every session issued before that moment stops working at once. Use it if a
// laptop is lost or a cookie may have leaked. Unset = no effect.
function sessionsValidAfter() {
  const raw = (process.env.ADMIN_SESSIONS_VALID_AFTER || "").trim();
  if (!raw) return 0;
  const n = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function base64UrlToBytes(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time comparison over two equal-length hex strings, to avoid
// timing attacks - same property Node's crypto.timingSafeEqual gave the
// original implementation.
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Verifies a "<base64url-payload>.<hex-hmac-signature>" session token.
// Returns the decoded payload ({ username, exp }) if valid, else null.
// Never throws - callers can treat null as "not authenticated".
export async function verifyAdminSessionToken(token) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!token || !secret) return null;

    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return null;

    const dataBytes = base64UrlToBytes(dataB64);
    const data = new TextDecoder().decode(dataBytes);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(data)
    );

    const expectedSig = bytesToHex(new Uint8Array(sigBuffer));

    if (!timingSafeEqualHex(sig, expectedSig)) return null;

    const payload = JSON.parse(data);
    if (!payload.exp || Date.now() > payload.exp) return null;

    // Absolute lifetime (tokens issued before this field existed have none and
    // are bounded by exp alone).
    if (payload.max && Date.now() > payload.max) return null;

    const validAfter = sessionsValidAfter();
    if (validAfter && !(payload.iat >= validAfter)) return null;

    // A valid signature only proves we issued this token at some point. The
    // admin must ALSO still be on the allow-list, so removing someone from
    // ADMIN_USERS cuts off their existing sessions straight away instead of
    // letting them run out their remaining hours. Fails closed if the list is
    // unset. (ADMIN_USERS is read here, not imported, because this runs on the
    // Edge Runtime as well as in Node.)
    const allowed = (process.env.ADMIN_USERS || "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (typeof payload.username !== "string" || !allowed.includes(payload.username)) return null;

    return payload;
  } catch {
    return null;
  }
}