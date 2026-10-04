import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { logActivity } from "@/lib/candidate-activity";
import { findAgencyTag } from "@/lib/agency-tags";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

export const POST = customerRoute(async (request, { params }, auth, body) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const tagId = typeof body?.tagId === "string" ? body.tagId : "";
  const tag = await findAgencyTag(supabase, agencyId, tagId);
  if (!tag) {
    return NextResponse.json({ error: "Unknown tag" }, { status: 400 });
  }

  const { data: candidate } = await (await agencyDb())
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
  const { error } = await (await agencyDb()).from("candidates").update({ tags }).eq("id", id).eq("agency_id", agencyId);
  if (error) {
    return NextResponse.json({ error: "Failed to add tag" }, { status: 500 });
  }

  await logActivity(supabase, id, "tag_added", recruiterDisplayName(profile) || userId, { tag: tag.label });
  return NextResponse.json({ tags });
}, { body: JsonObject, optionalBody: true });
