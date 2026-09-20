import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";

// "Team" is the set of profiles sharing an agency_id - there's no invite
// flow or separate `recruiters` table in the live Clerk-based signup path
// (see lib/create-profile.js), so today that's typically just the one
// agency owner. This still generalises correctly if multi-seat accounts
// get added later, since it's driven by agency_id rather than a fixed list.
export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const [{ data: members, error: membersError }, { data: candidates, error: candidatesError }] = await Promise.all([
    supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", agencyId),
    supabase
      .from("candidates")
      .select("recruiter_id, processing_status, stage, next_action")
      .eq("agency_id", agencyId)
      .not("recruiter_id", "is", null),
  ]);

  if (membersError || candidatesError) {
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }

  const now = Date.now();

  return NextResponse.json(
    (members ?? []).map((m) => {
      const owned = (candidates ?? []).filter((c) => c.recruiter_id === m.clerk_user_id);
      const completed = owned.filter((c) => c.processing_status === "completed");
      return {
        id: m.clerk_user_id,
        name: recruiterDisplayName(m) || "Unnamed",
        activeCandidates: completed.filter((c) => c.stage !== "Placed" && c.stage !== "Rejected").length,
        awaitingReview: completed.filter((c) => c.stage === "Screened" || c.stage === null).length,
        interviewing: completed.filter((c) => c.stage === "Interview").length,
        placed: completed.filter((c) => c.stage === "Placed").length,
        overdue: owned.filter(
          (c) => c.next_action && !c.next_action.completed && c.next_action.dueAt && new Date(c.next_action.dueAt).getTime() < now
        ).length,
      };
    })
  );
}
