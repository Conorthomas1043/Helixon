import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanUuid } from "@/lib/sanitize";
import { shapeAccount, testAccountTimeline, testAccountUsage } from "@/lib/admin/test-accounts";

// One test account for the console's drawer: the account, its usage, and
// everything done in the workspace, newest first. Read-only.

export async function GET(request, { params }) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { id } = await params;
    const accountId = cleanUuid(id);
    if (!accountId) return json({ error: "A valid test account id is required." }, 400);

    const { data: row, error } = await supabase.from("test_accounts").select("*").eq("id", accountId).maybeSingle();
    if (error) return adminDbError("test-accounts", error);
    if (!row || row.deleted_at) return json({ error: "Test account not found." }, 404);

    const [{ data: agency }, usage, timeline] = await Promise.all([
      supabase.from("agencies").select("id,name,screening_cap").eq("id", row.agency_id).maybeSingle(),
      testAccountUsage(supabase, row),
      testAccountTimeline(supabase, row),
    ]);
    return json({ ok: true, account: shapeAccount(row, agency, usage), timeline });
  } catch (error) {
    return adminErrorResponse("test-accounts", error);
  }
}
