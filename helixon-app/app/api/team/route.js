import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const { data: team, error } = await supabase
    .from("recruiters")
    .select("id, name, email, role, candidates(id, status, stage, next_action)");

  if (error) return Response.json({ error: "Failed to load team" }, { status: 500 });

  const now = Date.now();

  return Response.json(
    team.map((r) => {
      const owned = r.candidates ?? [];
      const completed = owned.filter((c) => c.status === "completed");
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        activeCandidates: completed.filter((c) => c.stage !== "Placed" && c.stage !== "Rejected").length,
        awaitingReview: completed.filter((c) => c.stage === "Screened" || c.stage === null).length,
        interviewing: completed.filter((c) => c.stage === "Interview").length,
        placed: completed.filter((c) => c.stage === "Placed").length,
        overdue: owned.filter(
          (c) => c.next_action && !c.next_action.completed && new Date(c.next_action.dueAt).getTime() < now
        ).length,
      };
    })
  );
}
