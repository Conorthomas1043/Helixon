import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText } from "@/lib/sanitize";

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const payload = await request.json().catch(() => null);
  const noteBody = cleanText(payload?.body, { max: 5000 });
  if (!noteBody) {
    return NextResponse.json({ error: "Note body required" }, { status: 400 });
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authorName = recruiterDisplayName(profile) || userId;

  const { data, error } = await supabase
    .from("candidate_notes")
    .insert({
      candidate_id: id,
      author_id: userId,
      author_name: authorName,
      body: noteBody,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  await logActivity(supabase, id, "note_added", authorName);

  return NextResponse.json(data);
}
