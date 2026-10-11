import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";
import { fields, id, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const ArtifactInput = fields({ artifactId: id, finalText: text(100000) });

// Records the text a recruiter finally sent after editing an AI-drafted email,
// and whether they kept the draft largely as written (see draft-email).
//
// Requires a signed-in user and only touches artifacts belonging to that
// user's agency, so an artifact id alone can't overwrite another agency's
// draft. Stores cleaned, length-capped text.
export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const parsedBody = await parseBody(request, ArtifactInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  const artifactId = cleanUuid(body?.artifactId);
  const finalText = cleanText(body?.finalText, { max: 10000 });

  if (!artifactId || !finalText) {
    return NextResponse.json({ ok: false, error: "artifactId and finalText are required." }, { status: 400 });
  }

  // Fetch the original draft - scoped to the caller's agency.
  const { data: artifact, error: fetchError } = await (await agencyDb())
    .from("artifacts")
    .select("content")
    .eq("id", artifactId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (fetchError) {
    reportError("[update-artifact] Lookup failed:", fetchError.message);
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

  const { error: updateError } = await (await agencyDb())
    .from("artifacts")
    .update({ content: updated })
    .eq("id", artifactId)
    .eq("agency_id", agencyId);

  if (updateError) {
    reportError("[update-artifact] Update failed:", updateError.message);
    return NextResponse.json({ ok: false, error: "Could not update the draft." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kept });
}
