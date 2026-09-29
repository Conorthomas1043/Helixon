// lib/request-capture.js
// What the request inspector (Admin > Traffic) keeps about each request,
// and what it deliberately doesn't. Every header is kept, but anything
// that could let someone act as the visitor - cookies, authorization,
// tokens, signatures, secrets - is replaced with a marker saying it was
// there. Query strings keep their shape with sensitive values removed.
// Request bodies are only ever kept for requests the firewall blocked
// (lib edge-log decides that), are truncated, and have the same redaction
// applied: normal traffic carries CVs and passwords, which never belong
// in a log.

const MAX_HEADERS = 60;
const MAX_HEADER_VALUE = 1000;
const MAX_QUERY = 2000;
export const MAX_PAYLOAD = 4000;

// Header names whose values are never stored.
const SECRET_HEADER = /(cookie|authorization|token|secret|signature|password|session|api[-_]?key|x-internal|oidc|csrf|x-vercel-proxy|x-vercel-sc-)/i;

// Query / form / JSON keys whose values are never stored.
const SECRET_KEY = /(pass|pwd|token|secret|key|code|auth|session|signature|sig$|ticket|jwt|otp|nonce|state|card|cvv|iban|ssn)/i;

const EMAIL = /[^\s@"'<>,;=&?]+@[^\s@"'<>,;=&?]+\.[a-z]{2,}/gi;
// Long opaque strings (tokens, keys) that turn up outside obvious fields.
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function clip(value, max) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}… [${s.length - max} more characters]` : s;
}

function scrubText(value) {
  return String(value).replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]");
}

// A value this module has already replaced. proxy.ts strips secrets before
// sending headers on, and edge-log redacts again before storing, so the
// second pass has to leave its own markers alone.
const MARKER = /^\[redacted: \d+ (characters|cookies?)( - [^\]]*)?\]$/;

/**
 * Headers with every secret swapped for a marker saying it was there, and
 * nothing else changed. Cookie values are dropped but their names kept
 * (so you can see a session was present). What proxy.ts sends to edge-log.
 */
export function stripSecretHeaders(headers) {
  const out = {};
  const entries = headers && typeof headers === "object" ? Object.entries(headers) : [];
  for (const [rawName, rawValue] of entries.slice(0, MAX_HEADERS)) {
    const name = String(rawName).toLowerCase();
    const value = String(rawValue ?? "");
    if (MARKER.test(value)) {
      out[name] = value;
    } else if (name === "cookie") {
      const names = value
        .split(";")
        .map((part) => part.split("=")[0].trim())
        .filter(Boolean);
      out[name] = `[redacted: ${names.length} cookie${names.length === 1 ? "" : "s"}${names.length ? ` - ${names.join(", ")}` : ""}]`;
    } else if (SECRET_HEADER.test(name)) {
      out[name] = `[redacted: ${value.length} characters]`;
    } else {
      out[name] = value;
    }
  }
  return out;
}

/** Request headers as stored: secrets redacted, very long values clipped. */
export function redactHeaders(headers) {
  const out = stripSecretHeaders(headers);
  for (const name of Object.keys(out)) {
    if (!MARKER.test(out[name])) out[name] = clip(out[name], MAX_HEADER_VALUE);
  }
  return out;
}

function redactPairs(params) {
  const parts = [];
  for (const [key, value] of params) {
    const safe = SECRET_KEY.test(key) ? "[redacted]" : scrubText(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(safe).replace(/%5B(redacted|email|token)%5D/g, "[$1]")}`);
  }
  return parts.join("&");
}

/** A query string ("a=1&b=2", with or without "?") with sensitive values removed. */
export function redactQuery(search) {
  const raw = String(search || "").replace(/^\?/, "");
  if (!raw) return "";
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return clip(scrubText(raw), MAX_QUERY);
  }
  return clip(redactPairs(params), MAX_QUERY);
}

function redactJson(value, depth = 0) {
  if (depth > 6) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactJson(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 100)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redactJson(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return scrubText(value);
  return value;
}

/**
 * A blocked request's body, made safe to store: JSON and form bodies have
 * sensitive fields redacted; anything else has emails and tokens removed.
 * Truncated to MAX_PAYLOAD characters.
 */
export function redactPayload(text, contentType = "") {
  const body = String(text || "");
  if (!body) return "";
  const type = String(contentType).toLowerCase();
  if (type.includes("json")) {
    try {
      return clip(JSON.stringify(redactJson(JSON.parse(body)), null, 2), MAX_PAYLOAD);
    } catch {
      // Not valid JSON after all - fall through to plain text.
    }
  }
  if (type.includes("x-www-form-urlencoded")) {
    try {
      return clip(redactPairs(new URLSearchParams(body)), MAX_PAYLOAD);
    } catch {
      // fall through
    }
  }
  return clip(scrubText(body).replace(/((?:pass(?:word)?|pwd|token|secret)\s*[=:]\s*)[^\s&"',;]+/gi, "$1[redacted]"), MAX_PAYLOAD);
}

/** Body types worth keeping from a blocked request (never files or binaries). */
export function isTextualBody(contentType) {
  const type = String(contentType || "").toLowerCase();
  return /json|x-www-form-urlencoded|text\/|xml|graphql/.test(type) && !type.includes("multipart");
}
