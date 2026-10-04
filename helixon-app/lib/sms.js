// Text messages through Twilio. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// and either TWILIO_FROM_NUMBER (+447...) or TWILIO_MESSAGING_SERVICE_SID.
// Replies and delivery updates come back to app/api/webhooks/twilio, which
// checks Twilio's signature. Until the env vars are set, texting reports
// itself as not set up and nothing else changes.

import "server-only";
import crypto from "crypto";

export const SMS_MAX = 640; // four segments - long enough, short enough to stay a text

export function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

// The URL Twilio posts to (and signs). Same origin as lib/mailer.js's
// siteUrl(), not imported so this file stays free of the database client.
export function smsWebhookUrl() {
  return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "")}/api/webhooks/twilio`;
}

// A phone number in E.164 (+447700900123), or null if it isn't one. A
// national number starting 0 is taken to be in SMS_DEFAULT_COUNTRY_CODE
// (44, the UK, unless set).
export function normalisePhone(raw, countryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || "44") {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/\(0\)/g, "").replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  else if (s.startsWith("0")) s = `+${countryCode}${s.slice(1)}`;
  else if (!s.startsWith("+")) s = `+${s}`;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

const STOP_WORDS = /^\s*(stop|stopall|unsubscribe|end|quit|cancel|optout|opt out)\s*[.!]?\s*$/i;
const START_WORDS = /^\s*(start|unstop|yes|optin|opt in)\s*[.!]?\s*$/i;

export function isStopMessage(body) {
  return STOP_WORDS.test(String(body ?? ""));
}

export function isStartMessage(body) {
  return START_WORDS.test(String(body ?? ""));
}

// Whether the newest STOP/START from this number (inbound rows, newest
// first) says they've opted out.
export function optedOut(inboundNewestFirst) {
  for (const m of inboundNewestFirst ?? []) {
    if (isStopMessage(m.body)) return true;
    if (isStartMessage(m.body)) return false;
  }
  return false;
}

// Sends a text. Resolves { sid, status, from }; throws with Twilio's message
// on failure.
export async function sendSms({ to, body }) {
  if (!smsConfigured()) throw new Error("Texting isn't set up yet.");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const form = new URLSearchParams({ To: to, Body: body, StatusCallback: smsWebhookUrl() });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM_NUMBER);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ? `Twilio: ${data.message}` : "The text couldn't be sent.");
  return { sid: data.sid, status: data.status, from: data.from || process.env.TWILIO_FROM_NUMBER || "" };
}

// Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the webhook URL followed
// by every POST parameter (sorted by name) as name+value, keyed with the
// auth token.
export function twilioSignature(url, params, authToken) {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return crypto.createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

export function verifyTwilioSignature(url, params, signature, authToken = process.env.TWILIO_AUTH_TOKEN) {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(twilioSignature(url, params, authToken));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
