import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

// PATCH { label, dueAt } to set a new next action.
// PATCH { completed: true } to complete the existing one.
export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;
  const actor = recruiterDisplayName(profile) || userId;

  const { data: existing } = await supabase
    .from("candidates")
    .select("next_action")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.completed) {
    const label = existing.next_action?.label;

    const { error } = await supabase.from("candidates").update({ next_action: null }).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Failed to complete next action" }, { status: 500 });
    }

    await logActivity(supabase, id, "next_action_completed", actor, { label });
    return NextResponse.json({ nextAction: null });
  }

  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  const nextAction = { label: body.label.trim(), dueAt: body.dueAt ?? null, completed: false };
  const { error } = await supabase.from("candidates").update({ next_action: nextAction }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to set next action" }, { status: 500 });
  }

  await logActivity(supabase, id, "next_action_set", actor, { label: nextAction.label });
  return NextResponse.json({ nextAction });
}
