import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getOnboardingProgress, setOnboardingTaskState } from "@/lib/employee-onboarding";

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

  const body = await request.json().catch(() => ({}));
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
