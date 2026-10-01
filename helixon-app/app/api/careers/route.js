import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanEmail, cleanLine, cleanText } from "@/lib/sanitize";
import { slugify, validSlug } from "@/lib/careers";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { siteUrl } from "@/lib/mailer";

// The agency's public jobs page settings (lib/careers.js).
//
// GET     the settings, the page's address, its feed, and whether you can
//         change them (owner/admin)
// PATCH { enabled?, slug?, intro?, website?, privacyEmail?, privacyNotice? }

function shape(agency, canManage) {
  const s = agency.settings || {};
  const base = siteUrl();
  return {
    enabled: agency.careers_enabled,
    slug: agency.careers_slug,
    suggestedSlug: slugify(agency.name || ""),
    intro: agency.careers_intro || "",
    website: agency.careers_website || "",
    privacyEmail: s.careers_privacy_email || "",
    privacyNotice: s.careers_privacy_notice || "",
    pageUrl: agency.careers_slug ? `${base}/jobs/${agency.careers_slug}` : null,
    feedUrl: agency.careers_slug ? `${base}/jobs/${agency.careers_slug}/feed.xml` : null,
    canManage,
  };
}

async function load(agencyId) {
  const { data } = await supabase.from("agencies").select("id, name, settings, careers_slug, careers_enabled, careers_intro, careers_website").eq("id", agencyId).maybeSingle();
  return data;
}

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [agency, manage] = await Promise.all([load(auth.agencyId), canManageWorkspace(auth)]);
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shape(agency, manage));
}

export async function PATCH(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const agency = await load(auth.agencyId);
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const update = {};
  const settings = { ...(agency.settings || {}) };

  if (body.slug !== undefined) {
    const slug = String(body.slug || "").trim().toLowerCase();
    if (!validSlug(slug)) return NextResponse.json({ error: "Use 3–50 lowercase letters, numbers and hyphens (not starting or ending with a hyphen)." }, { status: 400 });
    update.careers_slug = slug;
  }
  if (body.enabled !== undefined) {
    update.careers_enabled = body.enabled === true;
    if (update.careers_enabled && !(update.careers_slug || agency.careers_slug)) {
      return NextResponse.json({ error: "Choose the page's address first." }, { status: 400 });
    }
  }
  if (body.intro !== undefined) update.careers_intro = cleanText(body.intro, { max: 2000 }) || null;
  if (body.website !== undefined) update.careers_website = cleanLine(body.website, 300) || null;
  if (body.privacyEmail !== undefined) {
    const email = body.privacyEmail ? cleanEmail(body.privacyEmail) : "";
    if (body.privacyEmail && !email) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
    settings.careers_privacy_email = email || null;
  }
  if (body.privacyNotice !== undefined) settings.careers_privacy_notice = cleanText(body.privacyNotice, { max: 10000 }) || null;
  update.settings = settings;

  const { data, error } = await supabase
    .from("agencies")
    .update(update)
    .eq("id", auth.agencyId)
    .select("id, name, settings, careers_slug, careers_enabled, careers_intro, careers_website")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That address is taken - try another." }, { status: 409 });
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
  return NextResponse.json(shape(data, true));
}
