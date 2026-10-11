import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getOnboardingProgress, setOnboardingTaskState } from "@/lib/employee/onboarding";
import { fields, flag, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const OnboardingInput = fields({ taskKey: str(100), completed: flag });

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const { tasks, completedCount, totalCount } = await getOnboardingProgress(employeeId);
  return NextResponse.json({ ok: true, tasks, completedCount, totalCount });
}

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const parsedBody = await parseBody(request, OnboardingInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  if (!body.taskKey) {
    return NextResponse.json({ ok: false, error: "Missing taskKey." }, { status: 400 });
  }

  const result = await setOnboardingTaskState(employeeId, body.taskKey, !!body.completed);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const { tasks, completedCount, totalCount } = await getOnboardingProgress(employeeId);
  return NextResponse.json({ ok: true, tasks, completedCount, totalCount });
}
