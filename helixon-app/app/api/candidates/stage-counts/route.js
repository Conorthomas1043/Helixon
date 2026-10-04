import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { countCandidateStages } from "@/lib/candidates/list";

// GET /api/candidates/stage-counts - candidates per stage for the list's
// filters, for the stage tabs (lib/candidates/list.js). Takes the same query
// string as GET /api/candidates; stage and paging are ignored.
export const GET = customerRoute(async (request, _context, auth) => {
  const { status, body } = await countCandidateStages(auth, new URL(request.url).searchParams);
  return NextResponse.json(body, { status });
});
