import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getServicesSnapshot } from "@/lib/ops/live-services";

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json(await getServicesSnapshot());
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin services data error", error);
    return NextResponse.json({ error: "Unable to load live service data" }, { status: 500 });
  }
}
