import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { cleanSearchTerm, likePattern, quoted } from "@/lib/candidates/search";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// GET /api/search?q= - the search box in the nav (⌘K / Ctrl+K): candidates,
// jobs, clients and client contacts matching the term, a few of each.
// Candidates respect "own candidates only" (lib/permissions.js).

const PER_KIND = 6;

export const GET = customerRoute(async (request, _context, auth) => {
  const term = cleanSearchTerm(new URL(request.url).searchParams.get("q"));
  if (!term || term.length < 2) return NextResponse.json({ results: [] });
  const p = quoted(likePattern(term));
  const access = await getAccess(auth);

  const [candidates, jobs, clients, contacts] = await Promise.all([
    scopeCandidateQuery(
      (await agencyDb())
        .from("candidates")
        .select("id, full_name, name, email, current_title, stage, jobs(title)")
        .eq("agency_id", auth.agencyId)
        .or(`full_name.ilike.${p},email.ilike.${p},phone.ilike.${p},current_title.ilike.${p},current_company.ilike.${p}`)
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(PER_KIND),
      access,
      auth
    ),
    (await agencyDb()).from("jobs").select("id, title, client, status").eq("agency_id", auth.agencyId).or(`title.ilike.${p},client.ilike.${p}`).order("created_at", { ascending: false }).limit(PER_KIND),
    (await agencyDb()).from("clients").select("id, name, status").eq("agency_id", auth.agencyId).ilike("name", likePattern(term)).order("name").limit(PER_KIND),
    (await agencyDb()).from("client_contacts").select("id, client_id, name, email, job_title, clients(name)").eq("agency_id", auth.agencyId).or(`name.ilike.${p},email.ilike.${p}`).limit(PER_KIND),
  ]);

  const results = [
    ...(candidates.data ?? []).map((c) => ({
      kind: "candidate",
      id: c.id,
      title: c.full_name || c.name || "Unnamed candidate",
      subtitle: [c.jobs?.title, c.stage].filter(Boolean).join(" · ") || c.current_title || c.email || null,
      href: `/dashboard/candidates/${c.id}`,
    })),
    ...(jobs.data ?? []).map((j) => ({ kind: "job", id: j.id, title: j.title, subtitle: [j.client, j.status === "open" ? "Open" : "Closed"].filter(Boolean).join(" · "), href: `/dashboard/jobs/${j.id}` })),
    ...(clients.data ?? []).map((c) => ({ kind: "client", id: c.id, title: c.name, subtitle: c.status === "prospect" ? "Prospect" : "Client", href: `/dashboard/clients/${c.id}` })),
    ...(contacts.data ?? []).map((c) => ({
      kind: "contact",
      id: c.id,
      title: c.name,
      subtitle: [c.job_title, c.clients?.name].filter(Boolean).join(" · ") || c.email,
      href: `/dashboard/clients/${c.client_id}`,
    })),
  ];
  return NextResponse.json({ results });
});
