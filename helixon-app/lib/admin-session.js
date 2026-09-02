// ── Isomorphic admin session verification ───────────────────────────────────
// Deliberately has NO Node-only imports (no `crypto` module, no `Buffer`) so
// it can be safely imported from two very different places:
//
//   1. lib/admin-auth.js — used by Node.js route handlers / server
//      components (getAdminSession, requireAdminSession, isAdminUser).
//   2. proxy.ts — runs on the Edge Runtime. Edge Runtime does not support
//      Node's built-in `crypto` module; importing it there causes a
//      build-time error ("A Node.js API is used ... not supported in the
//      Edge Runtime"). This is why proxy.ts previously had no way to check
//      the admin session at all and /admin rendered for anyone.
//
// Signing (issuing new session tokens) still happens in lib/admin-auth.js
// using Node's `crypto` — that only ever runs in the login route, a
// Node.js context, so there's no restriction there. This file only
// *re-derives* the same HMAC-SHA256 to check a token that's already been
// issued. Web Crypto (crypto.subtle) computes byte-identical HMAC-SHA256
// output to Node's crypto.createHmac for the same key/data, so a token
// signed by admin-auth.js verifies correctly here, and vice versa.

export const ADMIN_SESSION_COOKIE = "helixon_admin_session";

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
// timing attacks — same property Node's crypto.timingSafeEqual gave the
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
// Never throws — callers can treat null as "not authenticated".
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

    return payload;
  } catch {
    return null;
  }
}