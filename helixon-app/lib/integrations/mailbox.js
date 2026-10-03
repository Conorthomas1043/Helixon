// Mailbox sync: reads a connected Gmail / Outlook mailbox (read-only) and
// files emails to or from candidates and client contacts on their
// timelines (lib/email-filing.js). Everything else in the mailbox is looked
// at only as far as its From/To/Cc headers and is never stored.
//
// Each run reads mail since the connection's sync_cursor (the first run
// goes back MAILBOX_LOOKBACK_DAYS, default 30), at most MAX_MESSAGES.

import { fileEmail, knownAddresses } from "@/lib/email-filing";
import { accessToken, updateConnection } from "@/lib/integrations/store";
import { direction, gmailMessage, nextCursor, otherParties, outlookMessage, syncStart } from "@/lib/integrations/mailbox-parse";

export const MAILBOX_PROVIDERS = ["gmail", "outlook"];

const MAX_MESSAGES = 300;
const MAX_LISTED = 3000;
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GRAPH = "https://graph.microsoft.com/v1.0";

async function getJson(url, token, headers = {}) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message || data?.error_description || `HTTP ${res.status}`).slice(0, 500));
  return data;
}

// The mailbox's address at connect time.
export async function mailboxAddress(provider, token) {
  if (provider === "gmail") return (await getJson(`${GMAIL}/profile`, token)).emailAddress;
  const me = await getJson(`${GRAPH}/me?$select=mail,userPrincipalName`, token);
  return me.mail || me.userPrincipalName;
}

// --- Gmail ---------------------------------------------------------------------

async function gmailEmails(token, since) {
  // Gmail lists newest first. Collect the ids (cheap), then take the
  // oldest MAX_MESSAGES so the cursor moves forward without skipping any;
  // the next run picks up the rest.
  const ids = [];
  let pageToken = "";
  const q = `after:${Math.floor(since.getTime() / 1000)} -in:chats -in:spam -in:trash`;
  while (ids.length < MAX_LISTED) {
    const params = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await getJson(`${GMAIL}/messages?${params}`, token);
    ids.push(...(page.messages || []).map((m) => m.id));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  const headersOnly = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Cc", "Subject", "Message-ID"]) headersOnly.append("metadataHeaders", h);
  const oldest = ids.reverse().slice(0, MAX_MESSAGES);
  const emails = [];
  for (let i = 0; i < oldest.length; i += 10) {
    const batch = await Promise.all(oldest.slice(i, i + 10).map((id) => getJson(`${GMAIL}/messages/${id}?${headersOnly}`, token).catch(() => null)));
    // Metadata has no body: the text is fetched only for mail that's filed.
    emails.push(...batch.filter(Boolean).map((m) => ({ ...gmailMessage(m), text: null, rawId: m.id })));
  }
  return emails;
}

async function gmailText(token, rawId) {
  const full = await getJson(`${GMAIL}/messages/${rawId}?format=full`, token);
  return gmailMessage(full).text;
}

// --- Outlook (Microsoft Graph) --------------------------------------------------------

async function outlookEmails(token, since) {
  const emails = [];
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $orderby: "receivedDateTime asc",
    $top: "50",
    $select: "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,bodyPreview,isDraft",
  });
  let url = `${GRAPH}/me/messages?${params}`;
  while (url && emails.length < MAX_MESSAGES) {
    const page = await getJson(url, token, { Prefer: 'outlook.body-content-type="text"' });
    emails.push(...(page.value || []).filter((m) => !m.isDraft).map(outlookMessage));
    url = page["@odata.nextLink"] || null;
  }
  return emails.slice(0, MAX_MESSAGES);
}

// --- Sync ------------------------------------------------------------------------------

// Resolves { scanned, filed }.
export async function syncMailbox(conn) {
  const owner = String(conn.account_id || "").toLowerCase();
  const label = conn.provider === "gmail" ? "Gmail" : "Outlook";
  let token;
  try {
    token = await accessToken(conn);
  } catch (err) {
    return { scanned: 0, filed: 0, error: err.message };
  }
  const since = syncStart(conn.sync_cursor, Number(process.env.MAILBOX_LOOKBACK_DAYS) || 30);
  let emails;
  try {
    emails = conn.provider === "gmail" ? await gmailEmails(token, since) : await outlookEmails(token, since);
  } catch (err) {
    await updateConnection(conn.id, { last_error: `${label}: ${err.message}`.slice(0, 1000), last_synced_at: new Date().toISOString() });
    return { scanned: 0, filed: 0, error: err.message };
  }

  // One lookup for every address in the batch, then only mail involving a
  // known person is filed.
  const known = await knownAddresses(conn.agency_id, emails.flatMap((e) => otherParties(e, owner)));
  let filed = 0;
  for (const email of emails) {
    const parties = otherParties(email, owner).filter((a) => known.has(a));
    if (!parties.length) continue;
    const dir = direction(email, owner);
    const subject = email.subject || "(no subject)";
    const res = await fileEmail({
      agencyId: conn.agency_id,
      userId: conn.user_id,
      providerId: email.id,
      fromLabel: email.fromLabel || email.from,
      from: email.from,
      to: email.to,
      cc: email.cc,
      subject: email.subject,
      parties,
      text: email.text ?? (() => gmailText(token, email.rawId).catch(() => "")),
      directionFor: (address) => (address === email.from ? "in" : dir === "out" ? "out" : "in"),
      activity: (d) => (d === "out" ? { type: "email_logged", note: `${subject} (from ${label})` } : { type: "email_received", note: subject }),
      at: email.at,
    });
    if (!res.duplicate && (res.candidates || res.clients)) filed += 1;
  }

  await updateConnection(conn.id, {
    sync_cursor: nextCursor(conn.sync_cursor || since.toISOString(), emails),
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });
  return { scanned: emails.length, filed };
}
