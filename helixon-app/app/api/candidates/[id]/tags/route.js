import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { TAG_CATALOG } from "@/lib/tag-catalog";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const { tagId } = await request.json();
  const tag = TAG_CATALOG.find((t) => t.id === tagId);
  if (!tag) {
    return NextResponse.json({ error: "Unknown tag" }, { status: 400 });
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("tags")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existingTags = candidate.tags ?? [];
  if (existingTags.includes(tagId)) {
    return NextResponse.json({ tags: existingTags });
  }

  const tags = [...existingTags, tagId];
  const { error } = await supabase.from("candidates").update({ tags }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to add tag" }, { status: 500 });
  }

  await logActivity(supabase, id, "tag_added", recruiterDisplayName(profile) || userId, { tag: tag.label });
  return NextResponse.json({ tags });
}
