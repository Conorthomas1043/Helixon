// An agency's own pipeline sub-stages and custom fields, kept in
// agencies.settings.customisation.
//
// Sub-stages refine the six core stages rather than replacing them
// ("1st interview", "2nd interview", "Final" all sit under Interview), so
// the funnel, analytics and reports keep meaning the same thing for every
// agency. A candidate's sub-stage is candidates.sub_stage.
//
// Custom fields are extra fields on candidates, jobs or clients ("Notice
// period", "Day rate", "Security clearance"), stored as
// <table>.custom_fields { fieldId: value } - see migration 20261001070000.

import { STAGE_LABELS } from "@/lib/stage-labels";

export const FIELD_TYPES = {
  text: "Short text",
  longtext: "Long text",
  number: "Number",
  date: "Date",
  select: "Pick from a list",
  checkbox: "Yes / no",
  url: "Link",
};
export const FIELD_ENTITIES = { candidate: "Candidates", job: "Jobs", client: "Clients" };
export const ENTITY_TABLES = { candidate: "candidates", job: "jobs", client: "clients" };
export const MAX_FIELDS = 60;
export const MAX_SUB_STAGES = 40;
const MAX_OPTIONS = 50;

const line = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function slug(label) {
  return (
    line(label, 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "field"
  );
}

// A stable id: the one it already has, else made from the label and kept
// unique among `taken`.
function idFor(item, taken) {
  const given = typeof item.id === "string" && /^[a-z0-9_]{1,40}$/.test(item.id) ? item.id : null;
  let id = given || slug(item.label);
  if (!given) {
    const base = id;
    for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  }
  taken.add(id);
  return id;
}

export function normaliseCustomisation(settings) {
  const c = settings?.customisation || {};
  return {
    subStages: Array.isArray(c.subStages) ? c.subStages.filter((s) => s && s.id && s.label && STAGE_LABELS[s.stage]) : [],
    customFields: Array.isArray(c.customFields) ? c.customFields.filter((f) => f && f.id && f.label && FIELD_TYPES[f.type] && FIELD_ENTITIES[f.entity]) : [],
  };
}

// The settings from a request body. { subStages, customFields } or { error }.
export function cleanCustomisation(body = {}) {
  const rawStages = Array.isArray(body.subStages) ? body.subStages : [];
  const rawFields = Array.isArray(body.customFields) ? body.customFields : [];
  if (rawStages.length > MAX_SUB_STAGES) return { error: `Up to ${MAX_SUB_STAGES} sub-stages.` };
  if (rawFields.length > MAX_FIELDS) return { error: `Up to ${MAX_FIELDS} custom fields.` };

  const stageIds = new Set();
  const subStages = [];
  for (const s of rawStages) {
    const label = line(s?.label, 60);
    if (!label) continue;
    if (!STAGE_LABELS[s.stage]) return { error: `"${label}" needs a stage to sit under.` };
    subStages.push({ id: idFor({ id: s.id, label }, stageIds), label, stage: s.stage });
  }

  const fieldIds = new Set();
  const customFields = [];
  for (const f of rawFields) {
    const label = line(f?.label, 60);
    if (!label) continue;
    if (!FIELD_TYPES[f.type]) return { error: `"${label}" needs a type.` };
    if (!FIELD_ENTITIES[f.entity]) return { error: `"${label}" needs to say what it's for.` };
    const field = { id: idFor({ id: f.id, label }, fieldIds), label, type: f.type, entity: f.entity };
    if (f.type === "select") {
      const options = [...new Set((Array.isArray(f.options) ? f.options : String(f.options || "").split("\n")).map((o) => line(o, 80)).filter(Boolean))].slice(0, MAX_OPTIONS);
      if (!options.length) return { error: `"${label}" needs some options to pick from.` };
      field.options = options;
    }
    const hint = line(f.hint, 200);
    if (hint) field.hint = hint;
    customFields.push(field);
  }
  return { subStages, customFields };
}

export function subStagesFor(subStages, stage) {
  return (subStages || []).filter((s) => s.stage === stage);
}

export function fieldsFor(customFields, entity) {
  return (customFields || []).filter((f) => f.entity === entity);
}

function cleanValue(def, raw) {
  if (raw === null || raw === undefined || raw === "") return { empty: true };
  switch (def.type) {
    case "text":
      return { value: line(raw, 300) || null };
    case "longtext": {
      const v = String(raw).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 4000);
      return { value: v || null };
    }
    case "number": {
      const n = Number(String(raw).replace(/[£$€,\s]/g, ""));
      if (!Number.isFinite(n) || Math.abs(n) > 1e12) return { error: `${def.label} must be a number.` };
      return { value: n };
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw)) || Number.isNaN(Date.parse(raw))) return { error: `${def.label} must be a date.` };
      return { value: String(raw) };
    case "select":
      if (!def.options?.includes(raw)) return { error: `Pick one of the options for ${def.label}.` };
      return { value: raw };
    case "checkbox":
      return { value: raw === true || raw === "true" || raw === "yes" };
    case "url": {
      const v = line(raw, 500);
      const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      try {
        const u = new URL(withScheme);
        if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) throw new Error();
        return { value: u.toString() };
      } catch {
        return { error: `${def.label} must be a web address.` };
      }
    }
    default:
      return { empty: true };
  }
}

// Merges `values` into `current` for the agency's fields on this entity:
// unknown keys are ignored, blanks remove a value. { values } or { error }.
export function cleanFieldValues(customFields, entity, values = {}, current = {}) {
  const defs = fieldsFor(customFields, entity);
  const out = { ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}) };
  for (const def of defs) {
    if (!(def.id in values)) continue;
    const r = cleanValue(def, values[def.id]);
    if (r.error) return { error: r.error };
    if (r.empty || r.value === null) delete out[def.id];
    else out[def.id] = r.value;
  }
  return { values: out };
}

// How a value reads on screen and in exports.
export function formatFieldValue(def, value) {
  if (value === null || value === undefined || value === "") return "";
  if (def.type === "checkbox") return value ? "Yes" : "No";
  if (def.type === "date") {
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (def.type === "number") return Number(value).toLocaleString("en-GB");
  return String(value);
}
