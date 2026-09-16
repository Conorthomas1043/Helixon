import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName, resolveRecruiterNames } from "@/lib/recruiter-directory";

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const { recruiterId } = await request.json();

  const { data: before } = await supabase
    .from("candidates")
    .select("recruiter_id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // recruiterId is a Clerk user id (candidates.recruiter_id, see
  // app/api/run) - confirm it belongs to this agency before assigning, so
  // a candidate can't be handed to an outsider by guessing their id.
  if (recruiterId) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("clerk_user_id")
      .eq("clerk_user_id", recruiterId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: "That team member could not be found." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("candidates")
    .update({ recruiter_id: recruiterId ?? null })
    .eq("id", id)
    .eq("agency_id", agencyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to reassign" }, { status: 500 });
  }

  const names = await resolveRecruiterNames(supabase, [before.recruiter_id, recruiterId]);
  await logActivity(supabase, id, "assigned", recruiterDisplayName(profile) || userId, {
    from: names.get(before.recruiter_id) ?? null,
    to: names.get(recruiterId) ?? null,
  });

  return NextResponse.json(data);
}
