// Candidate tags: the built-in set (lib/tag-catalog.js) plus the agency's
// own, kept in agencies.settings.custom_tags as [{ id, label }]. Tag ids
// are what candidates.tags stores; custom ids start with "c-" so they can
// never collide with a built-in one.
import { TAG_CATALOG } from "@/lib/tag-catalog";

export const MAX_CUSTOM_TAGS = 40;
export const MAX_TAG_LABEL = 30;

export function customTagId(label) {
  const slug = String(label || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `c-${slug}` : null;
}

export function cleanTagLabel(label) {
  const clean = String(label || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, MAX_TAG_LABEL);
}

async function loadSettings(supabase, agencyId) {
  const { data, error } = await supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.settings && typeof data.settings === "object" ? data.settings : {};
}

function customFrom(settings) {
  return Array.isArray(settings.custom_tags)
    ? settings.custom_tags.filter((t) => t && typeof t.id === "string" && typeof t.label === "string")
    : [];
}

// Every tag the agency can use: built-ins first, then its own.
export async function getAgencyTags(supabase, agencyId) {
  const custom = customFrom(await loadSettings(supabase, agencyId));
  return [...TAG_CATALOG, ...custom.map((t) => ({ ...t, custom: true }))];
}

export async function findAgencyTag(supabase, agencyId, tagId) {
  return (await getAgencyTags(supabase, agencyId)).find((t) => t.id === tagId) || null;
}

// Adds a custom tag (or returns the existing one with the same name).
export async function addAgencyTag(supabase, agencyId, rawLabel) {
  const label = cleanTagLabel(rawLabel);
  const id = customTagId(label);
  if (!label || !id) return { error: "Give the tag a name." };

  const settings = await loadSettings(supabase, agencyId);
  const custom = customFrom(settings);
  const existing = [...TAG_CATALOG, ...custom].find((t) => t.id === id || t.label.toLowerCase() === label.toLowerCase());
  if (existing) return { tag: existing };
  if (custom.length >= MAX_CUSTOM_TAGS) return { error: `You can have up to ${MAX_CUSTOM_TAGS} of your own tags.` };

  const tag = { id, label };
  const { error } = await supabase
    .from("agencies")
    .update({ settings: { ...settings, custom_tags: [...custom, tag] } })
    .eq("id", agencyId);
  if (error) throw new Error(error.message);
  return { tag: { ...tag, custom: true } };
}

// Removes a custom tag from the agency and from every candidate carrying it.
export async function removeAgencyTag(supabase, agencyId, tagId) {
  const settings = await loadSettings(supabase, agencyId);
  const custom = customFrom(settings);
  if (!custom.some((t) => t.id === tagId)) return { error: "Only your own tags can be deleted." };

  const { data: tagged, error: lookupError } = await supabase
    .from("candidates")
    .select("id, tags")
    .eq("agency_id", agencyId)
    .contains("tags", [tagId]);
  if (lookupError) throw new Error(lookupError.message);
  for (const row of tagged || []) {
    const { error } = await supabase
      .from("candidates")
      .update({ tags: (row.tags || []).filter((t) => t !== tagId) })
      .eq("id", row.id)
      .eq("agency_id", agencyId);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from("agencies")
    .update({ settings: { ...settings, custom_tags: custom.filter((t) => t.id !== tagId) } })
    .eq("id", agencyId);
  if (error) throw new Error(error.message);
  return { ok: true, untagged: tagged?.length || 0 };
}
