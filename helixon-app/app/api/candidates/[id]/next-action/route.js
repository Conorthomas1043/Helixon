import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { logActivity } from "@/lib/candidates/activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanLine } from "@/lib/sanitize";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// PATCH { label, dueAt } to set a new next action.
// PATCH { completed: true } to complete the existing one.
export const PATCH = customerRoute(async (request, { params }, auth, input) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId, profile } = auth;
  const { id } = await params;
  const actor = recruiterDisplayName(profile) || userId;

  const { data: existing } = await (await agencyDb())
    .from("candidates")
    .select("next_action")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = input;

  if (body.completed === true) {
    const label = existing.next_action?.label;

    const { error } = await (await agencyDb()).from("candidates").update({ next_action: null }).eq("id", id).eq("agency_id", agencyId);
    if (error) {
      return NextResponse.json({ error: "Failed to complete next action" }, { status: 500 });
    }

    await logActivity(supabase, id, "next_action_completed", actor, { label });
    return NextResponse.json({ nextAction: null });
  }

  const label = cleanLine(body.label, 200);
  if (!label) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  // dueAt is stored as given, so it has to be a real date - normalised to ISO.
  let dueAt = null;
  if (body.dueAt != null && body.dueAt !== "") {
    const due = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
    if (!due || Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: "dueAt must be a valid date" }, { status: 400 });
    }
    dueAt = due.toISOString();
  }

  const nextAction = { label, dueAt, completed: false };
  const { error } = await (await agencyDb()).from("candidates").update({ next_action: nextAction }).eq("id", id).eq("agency_id", agencyId);
  if (error) {
    return NextResponse.json({ error: "Failed to set next action" }, { status: 500 });
  }

  await logActivity(supabase, id, "next_action_set", actor, { label: nextAction.label });
  return NextResponse.json({ nextAction });
}, { body: JsonObject, optionalBody: true });
