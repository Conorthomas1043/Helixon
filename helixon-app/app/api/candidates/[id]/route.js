import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { eraseCandidates } from "@/lib/candidates/erasure";
import { cleanEmail, cleanLine } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidates/activity";
import { personCandidateIds } from "@/lib/candidates/person";
import { candidateHidden } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";
import { loadCandidateProfile } from "@/lib/candidates/profile";

export const GET = customerRoute(async (request, { params }, auth) => {
  const { id } = await params;
  const result = await loadCandidateProfile(auth, id);
  if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
});

// Correcting what was read off the CV: name, contact details and current
// role. Extraction gets these wrong sometimes (a mangled name, a phone number
// from a referee), and there was no way to fix them. Only the fields sent are
// changed; "" or null clears one (except the name).
const EDITABLE = {
  fullName: { column: "full_name", label: "name", clean: (v) => cleanLine(v, 120) },
  email: { column: "email", label: "email", clean: (v) => cleanEmail(v), email: true },
  phone: { column: "phone", label: "phone", clean: (v) => cleanLine(v, 40) },
  linkedin: { column: "linkedin", label: "LinkedIn", clean: (v) => cleanLine(v, 200) },
  location: { column: "location", label: "location", clean: (v) => cleanLine(v, 120) },
  currentTitle: { column: "current_title", label: "current title", clean: (v) => cleanLine(v, 160) },
  currentCompany: { column: "current_company", label: "current company", clean: (v) => cleanLine(v, 160) },
};

export const PATCH = customerRoute(async (request, { params }, auth, body) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const update = {};
  const changed = [];
  for (const [key, field] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    const raw = body[key];
    const empty = raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (key === "fullName") {
        return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
      }
      update[field.column] = null;
    } else {
      const value = field.clean(raw);
      if (!value) {
        return NextResponse.json(
          { error: field.email ? "That doesn't look like a valid email address." : `Invalid ${field.label}.` },
          { status: 400 }
        );
      }
      update[field.column] = value;
    }
    changed.push(field.label);
  }
  // Older rows read `name`; keep it in step with full_name.
  if (update.full_name) update.name = update.full_name;

  if (changed.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await (await agencyDb())
    .from("candidates")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select("id, full_name, name, email, phone, linkedin, location, current_title, current_company")
    .maybeSingle();

  if (error) {
    reportError("[candidates PATCH] Update failed:", error.message);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logActivity(supabase, id, "details_updated", recruiterDisplayName(profile) || userId, {
    note: `Updated ${changed.join(", ")}`,
  });

  return NextResponse.json({
    fullName: data.full_name || data.name || "Unnamed candidate",
    email: data.email,
    phone: data.phone,
    linkedin: data.linkedin,
    location: data.location,
    currentTitle: data.current_title,
    currentCompany: data.current_company,
  });
}, { body: JsonObject, optionalBody: true });

// Permanently erases a candidate and every row that references them - the
// tool an agency needs to fulfil a data subject's right to erasure (privacy
// policy: "Requests should be directed to the recruitment agency... who acts
// as the data controller"). The ordering and failure handling live in
// lib/candidates/erasure.js, shared with bulk delete.
export const DELETE = customerRoute(async (request, { params }, auth) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId } = auth;
  const { id } = await params;

  const { data: candidate, error: lookupError } = await (await agencyDb())
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Failed to look up candidate" }, { status: 500 });
  }
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ?all=1 erases every record for this person - each job they were
  // screened for is a separate row (lib/candidates/person.js). An erasure
  // request needs all of them; plain removal from one job doesn't.
  const everyRecord = new URL(request.url).searchParams.get("all") === "1";
  const ids = everyRecord ? await personCandidateIds(supabase, agencyId, id).catch(() => [id]) : [id];

  const { erased, failedStep } = await eraseCandidates(supabase, agencyId, ids);
  if (erased) await logAudit({ auth, request, action: "candidate.deleted", targetType: "candidate", targetId: id, summary: everyRecord ? `Erased every record for a person (${erased})` : "Deleted a candidate" });
  if (failedStep || erased !== ids.length) {
    return NextResponse.json(
      { error: `Failed to erase candidate data (${failedStep || "candidates"}). Safe to retry.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, erased });
});
