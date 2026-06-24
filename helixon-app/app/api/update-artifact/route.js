import { supabase } from "@/lib/supabase";

export async function POST(request) {
  try {
    const { artifactId, finalText } = await request.json();

    // Fetch the original draft
    const { data: artifact } = await supabase
      .from("artifacts")
      .select("content")
      .eq("id", artifactId)
      .single();

    const original = artifact?.content?.original_text || "";

    // Simple word-overlap similarity check
    const origWords = new Set(original.toLowerCase().split(/\s+/));
    const finalWords = finalText.toLowerCase().split(/\s+/);
    const shared = finalWords.filter((w) => origWords.has(w)).length;
    const similarity = finalWords.length > 0 ? shared / finalWords.length : 0;

    // "kept" = true if less than 30% was rewritten
    const kept = similarity > 0.7;

    const updated = {
      ...artifact.content,
      final_text: finalText,
      kept,
      rewrite_count: (artifact.content?.rewrite_count || 0) + 1,
    };

    await supabase
      .from("artifacts")
      .update({ content: updated })
      .eq("id", artifactId);

    return Response.json({ ok: true, kept });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}