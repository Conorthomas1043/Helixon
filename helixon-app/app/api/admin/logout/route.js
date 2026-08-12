import { destroyAdminSession } from "@/lib/admin-auth";

export async function POST() {
  await destroyAdminSession();
  return Response.json({ ok: true });
}