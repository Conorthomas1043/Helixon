// Outgoing webhooks: when something happens in an agency's workspace,
// every endpoint it has subscribed gets a signed JSON POST (migration
// 20261001085000). Zapier, Make and the agency's own systems listen for
// these. Delivery is best effort - callers run emitWebhook inside after()
// so a slow endpoint never delays the user.
//
// Body: { id, event, createdAt, data }
// Headers: Helixon-Event, Helixon-Delivery, Helixon-Signature: t=<unix>,v1=<hex>
// where v1 = HMAC-SHA256(secret, `${t}.${body}`).

import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { supabase } from "@/lib/supabase";

export const WEBHOOK_EVENTS = {
  "candidate.created": "A candidate is added (screened, applied, imported by API or the LinkedIn extension)",
  "candidate.stage_changed": "A candidate moves stage",
  "application.received": "Someone applies through your jobs page",
  "interview.scheduled": "An interview is scheduled",
  "placement.created": "An offer is recorded",
  "placement.updated": "An offer or placement changes status",
  "invoice.created": "An invoice is raised",
  "invoice.paid": "An invoice is marked paid",
  "reference.received": "A referee answers",
  "signature.signed": "A document sent for e-signature is signed",
  "signature.declined": "Someone declines to sign a document",
  "interview.booked": "A candidate books an interview time from a booking link",
  "candidate.self_updated": "A candidate updates their details on their private link",
};

const MAX_FAILURES = 20;

export function webhookSecret() {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

export function signWebhook(secret, timestamp, body) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

// Private, loopback, link-local and other non-public addresses.
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

// A URL we're willing to POST to: https, a public host name, normal port.
// { url } or { error }.
export function checkWebhookUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { error: "That isn't a web address." };
  }
  if (u.protocol !== "https:") return { error: "Webhook addresses must start with https://" };
  if (u.username || u.password) return { error: "Leave the user name and password out of the address." };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? isPrivateAddress(host) : host === "localhost" || !host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/.test(host)) {
    return { error: "Webhooks must go to a public address." };
  }
  if (u.port && u.port !== "443") return { error: "Use the standard https port." };
  if (u.toString().length > 500) return { error: "That address is too long." };
  return { url: u.toString() };
}

async function resolvesPublic(hostname) {
  if (net.isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

// POSTs one delivery. Returns { status } or { error }.
export async function deliver(endpoint, event, data) {
  const checked = checkWebhookUrl(endpoint.url);
  if (checked.error) return { error: checked.error };
  if (!(await resolvesPublic(new URL(checked.url).hostname))) return { error: "The address doesn't resolve to a public server." };
  const id = crypto.randomUUID();
  const body = JSON.stringify({ id, event, createdAt: new Date().toISOString(), data });
  const t = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(checked.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Helixon-Webhooks/1.0",
        "Helixon-Event": event,
        "Helixon-Delivery": id,
        "Helixon-Signature": `t=${t},v1=${signWebhook(endpoint.secret, t, body)}`,
      },
      body,
    });
    return res.ok ? { status: res.status } : { status: res.status, error: `Responded ${res.status}` };
  } catch (err) {
    return { error: err?.name === "TimeoutError" ? "Timed out after 8 seconds" : "Couldn't connect" };
  }
}

async function record(endpoint, result) {
  const failed = Boolean(result.error);
  const failures = failed ? endpoint.failure_count + 1 : 0;
  await supabase
    .from("webhook_endpoints")
    .update({
      last_status: result.status ?? null,
      last_error: result.error ? String(result.error).slice(0, 300) : null,
      last_delivery_at: new Date().toISOString(),
      failure_count: failures,
      ...(failures >= MAX_FAILURES ? { active: false } : {}),
    })
    .eq("id", endpoint.id);
}

// Sends `event` to the agency's endpoints that want it. Never throws.
export async function emitWebhook(agencyId, event, data) {
  try {
    if (!agencyId || !WEBHOOK_EVENTS[event]) return;
    const { data: endpoints, error } = await supabase.from("webhook_endpoints").select("id, url, secret, events, failure_count").eq("agency_id", agencyId).eq("active", true);
    if (error || !endpoints?.length) return;
    const wanted = endpoints.filter((e) => !e.events?.length || e.events.includes(event));
    await Promise.all(wanted.map(async (e) => record(e, await deliver(e, event, data))));
  } catch (err) {
    console.error("[webhooks] Emit failed:", err?.message);
  }
}

// The candidate fields a webhook carries.
export function candidatePayload(c, extra = {}) {
  return {
    id: c.id,
    name: c.full_name || c.name || null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedin: c.linkedin ?? null,
    location: c.location ?? null,
    currentTitle: c.current_title ?? null,
    currentCompany: c.current_company ?? null,
    stage: c.stage ?? null,
    matchScore: c.match_score ?? null,
    jobId: c.job_id ?? null,
    source: c.source ?? null,
    createdAt: c.created_at ?? null,
    ...extra,
  };
}
