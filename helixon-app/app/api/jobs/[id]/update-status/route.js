import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const VALID_STATUSES = ["open", "waitlist", "interviewing", "closed"];

export async function POST(request, { params }) {
  try {
    const { id: jobId } = params;
    const { status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const { error } = await supabase
      .from("jobs")
      .update({ status })
      .eq("id", jobId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, jobId, status });

  } catch (err) {
    console.error("[jobs/:id/update-status] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}