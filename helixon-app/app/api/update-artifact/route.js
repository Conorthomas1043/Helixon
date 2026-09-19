import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanText, cleanUuid } from "@/lib/sanitize";

// Records the text a recruiter finally sent after editing an AI-drafted email,
// and whether they kept the draft largely as written (see draft-email).
//
// Previously this had no authentication and no agency check, so anyone who had
// or guessed an artifact id could overwrite any agency's saved draft. It now
// requires a signed-in user, only touches artifacts belonging to that user's
// agency, and stores cleaned, length-capped text.
export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const body = await request.json().catch(() => null);
  const artifactId = cleanUuid(body?.artifactId);
  const finalText = cleanText(body?.finalText, { max: 10000 });

  if (!artifactId || !finalText) {
    return NextResponse.json({ ok: false, error: "artifactId and finalText are required." }, { status: 400 });
  }

  // Fetch the original draft - scoped to the caller's agency.
  const { data: artifact, error: fetchError } = await supabase
    .from("artifacts")
    .select("content")
    .eq("id", artifactId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (fetchError) {
    console.error("[update-artifact] Lookup failed:", fetchError.message);
    return NextResponse.json({ ok: false, error: "Could not update the draft." }, { status: 500 });
  }
  if (!artifact) {
    return NextResponse.json({ ok: false, error: "Draft not found." }, { status: 404 });
  }

  const original = artifact.content?.original_text || "";

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

  const { error: updateError } = await supabase
    .from("artifacts")
    .update({ content: updated })
    .eq("id", artifactId)
    .eq("agency_id", agencyId);

  if (updateError) {
    console.error("[update-artifact] Update failed:", updateError.message);
    return NextResponse.json({ ok: false, error: "Could not update the draft." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kept });
}
