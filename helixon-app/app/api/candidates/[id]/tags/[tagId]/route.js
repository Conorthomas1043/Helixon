import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";
import { logActivity } from "@/lib/candidate-activity";
import { TAG_CATALOG } from "@/lib/tag-catalog";

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data: candidate } = await supabase.from("candidates").select("tags").eq("id", params.id).single();
  if (!candidate) return Response.json({ error: "Not found" }, { status: 404 });

  const tags = candidate.tags.filter((t) => t !== params.tagId);
  const { error } = await supabase.from("candidates").update({ tags }).eq("id", params.id);
  if (error) return Response.json({ error: "Failed to remove tag" }, { status: 500 });

  const tag = TAG_CATALOG.find((t) => t.id === params.tagId);
  await logActivity(supabase, params.id, "tag_removed", recruiter.name, { tag: tag?.label ?? params.tagId });
  return Response.json({ tags });
}
