import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const VALID_STAGES = [
  "new", "shortlisted", "contacted", "interview",
  "offer", "placed", "rejected", "waitlist",
];

export async function POST(request) {
  try {
    const { scoreId, stage } = await request.json();

    if (!scoreId) {
      return NextResponse.json({ ok: false, error: "Missing scoreId" }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ ok: false, error: "Invalid stage" }, { status: 400 });
    }

    const { error } = await supabase
      .from("scores")
      .update({ stage })
      .eq("id", scoreId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, scoreId, stage });

  } catch (err) {
    console.error("[scores/update-stage] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}