// Encrypts OAuth tokens (and anything else secret) before it's stored:
// AES-256-GCM with INTEGRATIONS_ENCRYPTION_KEY - 32 random bytes, as 64 hex
// characters or base64 (`openssl rand -hex 32`). Output is
// "v1.<iv>.<tag>.<ciphertext>" in base64url. Without the key, integrations
// that store tokens report themselves as not set up.

import "server-only";
import crypto from "crypto";

function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY || "";
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

export function secretBoxReady() {
  return Boolean(key());
}

export function seal(value) {
  const k = key();
  if (!k) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is missing or not 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

// The sealed value, or null if it can't be opened (wrong key, tampered).
export function open(sealed) {
  const k = key();
  if (!k || typeof sealed !== "string") return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}
