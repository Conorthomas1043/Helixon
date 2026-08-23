import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";
import { TAG_CATALOG } from "@/lib/tag-catalog";

export async function POST(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { tagId } = await request.json();
  const tag = TAG_CATALOG.find((t) => t.id === tagId);
  if (!tag) return Response.json({ error: "Unknown tag" }, { status: 400 });

  const { data: candidate } = await supabase.from("candidates").select("tags").eq("id", params.id).single();
  if (!candidate) return Response.json({ error: "Not found" }, { status: 404 });
  if (candidate.tags.includes(tagId)) return Response.json({ tags: candidate.tags });

  const tags = [...candidate.tags, tagId];
  const { error } = await supabase.from("candidates").update({ tags }).eq("id", params.id);
  if (error) return Response.json({ error: "Failed to add tag" }, { status: 500 });

  await logActivity(supabase, params.id, "tag_added", recruiter.name, { tag: tag.label });
  return Response.json({ tags });
}
