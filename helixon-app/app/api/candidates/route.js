import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { listCandidates } from "@/lib/candidate-list";

// GET /api/candidates - one page of the candidate list (lib/candidate-list.js).
export const GET = customerRoute(async (request, _context, auth) => {
  const { status, body } = await listCandidates(auth, new URL(request.url).searchParams);
  return NextResponse.json(body, { status });
});
