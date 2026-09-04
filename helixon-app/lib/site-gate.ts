// Shared by app/api/site-gate/route.ts and proxy.ts.
//
// Uses Web Crypto (crypto.subtle) rather than node:crypto because
// proxy.ts runs on the Edge runtime, which doesn't have node:crypto -
// but does have the standard SubtleCrypto API, and so does modern Node.
// Keeping both sides on the same implementation means "signed by the
// API route" and "verified by the proxy" are actually the same math.

export const GATE_COOKIE_NAME = "helixon_dev_unlocked";
const GATE_VALUE = "granted";

// Shared with app/api/site-gate/route.ts so the cookie's browser-side
// maxAge and this file's server-side expiry check can never drift apart.
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  const secret = process.env.SITE_GATE_SECRET;
  if (!secret) {
    throw new Error(
      "SITE_GATE_SECRET is not set - add it to your environment before the gate can issue or verify cookies."
    );
  }
  return secret;
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function randomHex(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Builds the signed cookie value to hand back to the browser on success.
 *
 * FIX: this used to sign the constant string "granted", so every issued
 * cookie had the exact same value forever - anyone who ever saw one copy
 * of it (a screenshot, a log line, a shared machine) could replay it
 * indefinitely. Each call now mints a random nonce and embeds the issue
 * time, both covered by the signature, so every issuance is unique and
 * verifyGateCookie() can enforce its own expiry independent of whatever
 * maxAge/expires attributes did or didn't survive on the copy.
 */
export async function signGateCookie(): Promise<string> {
  const nonce = randomHex(16);
  const issuedAt = Date.now().toString();
  const payload = `${GATE_VALUE}.${nonce}.${issuedAt}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

/**
 * Verifies a cookie value came from signGateCookie() and wasn't just
 * typed into devtools by a visitor. httpOnly stops JS from reading or
 * writing the cookie, but it doesn't stop someone manually adding a
 * cookie named the same thing in their own browser's dev tools - the
 * signature is what actually stops that from working. The embedded
 * issue timestamp additionally caps how long any single issued value
 * stays valid, even if it's copied into a context where the cookie's
 * own maxAge doesn't apply (e.g. hand-set with no expiry).
 */
export async function verifyGateCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return false;
  const [value, nonce, issuedAtStr, sig] = parts;
  if (value !== GATE_VALUE || !nonce || !issuedAtStr) return false;

  const payload = `${value}.${nonce}.${issuedAtStr}`;
  const expected = await hmacHex(payload);
  if (!timingSafeEqual(sig, expected)) return false;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > GATE_MAX_AGE_SECONDS * 1000) return false;

  return true;
}

// Simple in-memory rate limit for the unlock endpoint. Resets on
// redeploy/restart - a speed bump against script-guessing, not a
// security boundary.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

export function tooManyGateAttempts(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  attempts.set(ip, entry);
  return entry.count > MAX_ATTEMPTS;
}