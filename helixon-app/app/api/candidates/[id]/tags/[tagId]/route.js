import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { findAgencyTag } from "@/lib/agency-tags";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { candidateHidden } from "@/lib/permissions";

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId, profile } = auth;
  const { id, tagId } = await params;

  const { data: candidate } = await supabase
    .from("candidates")
    .select("tags")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = (candidate.tags ?? []).filter((t) => t !== tagId);
  const { error } = await supabase.from("candidates").update({ tags }).eq("id", id).eq("agency_id", agencyId);
  if (error) {
    return NextResponse.json({ error: "Failed to remove tag" }, { status: 500 });
  }

  const tag = await findAgencyTag(supabase, agencyId, tagId).catch(() => null);
  await logActivity(supabase, id, "tag_removed", recruiterDisplayName(profile) || userId, { tag: tag?.label ?? tagId });
  return NextResponse.json({ tags });
}
