import crypto from "crypto";
import { getRedis } from "@/lib/redis";

// Optional two-factor login for admins: a 6-digit time-based code (RFC 6238 -
// the same scheme Google Authenticator, 1Password, Authy etc. use).
//
// Turn it on per admin by setting ADMIN_TOTP_SECRET_<USERNAME> (a base32
// secret - generate one with `node scripts/generate-admin-totp.js`). An admin
// with a secret must supply a valid code to sign in; an admin without one signs
// in with just their password, exactly as before, so nobody is locked out by
// this shipping. To make it mandatory for everyone, set ADMIN_REQUIRE_2FA=true:
// an admin with no secret is then refused until one is configured.

const STEP_SECONDS = 30;
const DIGITS = 6;
// Accept the previous and next 30s step as well, to tolerate clock drift.
const WINDOW_STEPS = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const clean = String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += BASE32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

// RFC 4226 HOTP over a counter.
function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpCode(secretBase32, atMs = Date.now()) {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / 1000 / STEP_SECONDS));
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function secretFor(username) {
  return process.env[`ADMIN_TOTP_SECRET_${String(username).toUpperCase()}`] || null;
}

export function adminHasTotp(username) {
  return Boolean(secretFor(username));
}

export function isTwoFactorRequired() {
  return String(process.env.ADMIN_REQUIRE_2FA || "").toLowerCase() === "true";
}

// A code is valid once. Without this, someone who shoulder-surfs or intercepts
// a code could reuse it for the rest of its 30-60 second life. Recorded in
// Redis (shared across serverless instances); falls back to memory when Redis
// isn't available.
const usedLocally = new Map();

async function markUsed(username, counter) {
  const key = `helixon:admin-totp:${String(username).toLowerCase()}:${counter}`;
  const redisPromise = getRedis();
  if (redisPromise) {
    try {
      const redis = await redisPromise;
      const result = await redis.set(key, "1", { NX: true, EX: STEP_SECONDS * (WINDOW_STEPS * 2 + 2) });
      return result === "OK";
    } catch (err) {
      console.error("[admin-totp] Redis error, using in-memory replay guard:", err.message);
    }
  }
  const now = Date.now();
  for (const [k, expires] of usedLocally) if (expires <= now) usedLocally.delete(k);
  if (usedLocally.has(key)) return false;
  usedLocally.set(key, now + STEP_SECONDS * (WINDOW_STEPS * 2 + 2) * 1000);
  return true;
}

/**
 * Checks a code for an admin.
 *   { ok: true }                    valid code, or 2FA isn't set up and isn't required
 *   { ok: false, reason: "..." }    reason is for server logs only - never show it to the client
 */
export async function verifyAdminTotp(username, code) {
  const secretText = secretFor(username);

  if (!secretText) {
    return isTwoFactorRequired()
      ? { ok: false, reason: "2FA is required but no ADMIN_TOTP_SECRET is configured for this admin" }
      : { ok: true };
  }

  const submitted = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(submitted)) return { ok: false, reason: "missing or malformed code" };

  const secret = base32Decode(secretText);
  const nowCounter = Math.floor(Date.now() / 1000 / STEP_SECONDS);

  for (let drift = -WINDOW_STEPS; drift <= WINDOW_STEPS; drift++) {
    const counter = nowCounter + drift;
    if (timingSafeEqualStr(hotp(secret, counter), submitted)) {
      return (await markUsed(username, counter))
        ? { ok: true }
        : { ok: false, reason: "code already used" };
    }
  }

  return { ok: false, reason: "wrong code" };
}
