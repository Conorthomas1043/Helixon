// Offices or brands (agencies.settings.offices = [{ id, name }]) and who's
// in which (agencies.settings.memberOffices = { userId: officeId }). Jobs
// carry jobs.office_id; the jobs list and Analytics filter by it.

import crypto from "crypto";

export const MAX_OFFICES = 50;
const ID_RE = /^[a-z0-9-]{1,40}$/;

export function normaliseOffices(settings) {
  const offices = (Array.isArray(settings?.offices) ? settings.offices : [])
    .filter((o) => o && ID_RE.test(o.id) && typeof o.name === "string" && o.name.trim())
    .slice(0, MAX_OFFICES)
    .map((o) => ({ id: o.id, name: o.name.trim().slice(0, 80) }));
  const ids = new Set(offices.map((o) => o.id));
  const memberOffices = {};
  for (const [userId, officeId] of Object.entries(settings?.memberOffices || {})) {
    if (/^[\w-]{1,64}$/.test(userId) && ids.has(officeId)) memberOffices[userId] = officeId;
  }
  return { offices, memberOffices };
}

function newId(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "office";
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

// The offices and assignments from a settings form: { offices: [{ id?, name }],
// memberOffices }. New offices get an id; unknown ids, blank names and
// assignments to offices that no longer exist are dropped. { error } if
// there are too many or two share a name.
export function cleanOffices(body = {}) {
  const list = Array.isArray(body.offices) ? body.offices : [];
  if (list.length > MAX_OFFICES) return { error: `Up to ${MAX_OFFICES} offices.` };
  const offices = [];
  const names = new Set();
  for (const o of list) {
    const name = typeof o?.name === "string" ? o.name.trim().slice(0, 80) : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (names.has(key)) return { error: `"${name}" is listed twice.` };
    names.add(key);
    offices.push({ id: typeof o.id === "string" && ID_RE.test(o.id) ? o.id : newId(name), name });
  }
  const ids = new Set(offices.map((o) => o.id));
  const memberOffices = {};
  for (const [userId, officeId] of Object.entries(body.memberOffices || {})) {
    if (/^[\w-]{1,64}$/.test(userId) && ids.has(officeId)) memberOffices[userId] = officeId;
  }
  return { offices, memberOffices };
}
