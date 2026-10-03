// Turning Gmail / Outlook API messages into one plain shape:
//   { id, messageId, from, to: [], cc: [], subject, text, at }
// (addresses lower-cased). Pure, so it's tested; the calls are in mailbox.js.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const MAX_TEXT = 20000;

export function addressesIn(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.flatMap((v) => String(v ?? "").toLowerCase().match(EMAIL_RE) || []))];
}

function decodeBase64Url(data) {
  try {
    return Buffer.from(String(data || ""), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

export function htmlToText(html) {
  return String(html || "")
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

// The plain-text body of a Gmail message payload (format=full): the first
// text/plain part, else the first text/html part as text.
export function gmailBodyText(payload) {
  const parts = [];
  const walk = (p) => {
    if (!p) return;
    if (p.body?.data && /^text\/(plain|html)/i.test(p.mimeType || "")) parts.push(p);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  const plain = parts.find((p) => /^text\/plain/i.test(p.mimeType));
  if (plain) return decodeBase64Url(plain.body.data).slice(0, MAX_TEXT);
  const html = parts.find((p) => /^text\/html/i.test(p.mimeType));
  return html ? htmlToText(decodeBase64Url(html.body.data)).slice(0, MAX_TEXT) : "";
}

export function gmailMessage(msg) {
  const headers = {};
  for (const h of msg?.payload?.headers || []) headers[String(h.name).toLowerCase()] = h.value;
  return {
    id: `gmail:${msg.id}`,
    messageId: headers["message-id"] || null,
    from: addressesIn(headers.from)[0] || null,
    fromLabel: String(headers.from || "").slice(0, 200),
    to: addressesIn(headers.to),
    cc: addressesIn(headers.cc),
    subject: String(headers.subject || "").slice(0, 500),
    text: msg?.payload?.parts || msg?.payload?.body?.data ? gmailBodyText(msg.payload) : String(msg?.snippet || ""),
    at: msg?.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
  };
}

const graphAddress = (r) => r?.emailAddress?.address;

export function outlookMessage(msg) {
  const body = msg?.body?.contentType === "html" ? htmlToText(msg.body.content) : String(msg?.body?.content || msg?.bodyPreview || "");
  return {
    id: `outlook:${msg.id}`,
    messageId: msg?.internetMessageId || null,
    from: addressesIn(graphAddress(msg?.from))[0] || null,
    fromLabel: String(msg?.from?.emailAddress?.name || graphAddress(msg?.from) || "").slice(0, 200),
    to: addressesIn((msg?.toRecipients || []).map(graphAddress)),
    cc: addressesIn((msg?.ccRecipients || []).map(graphAddress)),
    subject: String(msg?.subject || "").slice(0, 500),
    text: body.slice(0, MAX_TEXT),
    at: msg?.receivedDateTime || msg?.sentDateTime || null,
  };
}

// Everyone on an email other than the mailbox owner (and Helixon's own
// reply+/log+ addresses): the people it could be filed against.
export function otherParties(email, owner) {
  const me = String(owner || "").toLowerCase();
  return addressesIn([email.from, ...email.to, ...email.cc]).filter((a) => a !== me && !/^(log|reply)\+/.test(a));
}

// "out" when the owner sent it, otherwise "in".
export function direction(email, owner) {
  return email.from && email.from === String(owner || "").toLowerCase() ? "out" : "in";
}

// Where the next sync starts: an hour before the newest message seen (late
// arrivals), never later than now, or `lookbackDays` ago on the first run.
export function nextCursor(previous, emails, now = Date.now()) {
  const newest = Math.max(0, ...emails.map((e) => Date.parse(e.at || "") || 0));
  const prev = Date.parse(previous || "") || 0;
  const best = Math.max(prev, newest - 3600000);
  return best > 0 ? new Date(Math.min(best, now)).toISOString() : previous || null;
}

export function syncStart(cursor, lookbackDays = 30, now = Date.now()) {
  const t = Date.parse(cursor || "");
  return new Date(Number.isNaN(t) ? now - lookbackDays * 86400000 : t);
}
