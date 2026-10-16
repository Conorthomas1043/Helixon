import { clerkClient } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminJson as json, adminErrorResponse } from "@/lib/admin/http";
import { cleanUuid } from "@/lib/sanitize";
import { applyTestAccountAction, createTestAccount, deleteTestAccount, listTestAccounts } from "@/lib/admin/test-accounts";
import { fields, id, num, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

// The admin console's Test accounts page: list (GET), create (POST), act on
// one (PATCH: extend, end, set_cap, reset_password) and delete (DELETE).
// The operations are in lib/admin/test-accounts.js. Passwords are returned
// once and never written to the audit log.

const CreateInput = fields({ name: text(200), email: text(320), agencyName: text(200), days: num, screeningCap: num });
const ActionInput = fields({ id, action: text(40), days: num, cap: num });
const DeleteInput = fields({ id });

async function loadAccount(supabase, accountId) {
  const { data, error } = await supabase.from("test_accounts").select("*").eq("id", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET() {
  try {
    await requireAdminSession();
    return json({ ok: true, accounts: await listTestAccounts(getAdminSupabase()) });
  } catch (error) {
    return adminErrorResponse("test-accounts", error);
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsed = await parseBody(request, CreateInput, { allowEmpty: true });
    if (parsed.response) return parsed.response;

    const result = await createTestAccount({ client: await clerkClient(), supabase: getAdminSupabase(), input: parsed.body, admin });
    if (result.error) return json({ error: result.error }, result.status);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "test_account_create",
      targetType: "test_account",
      targetId: result.account.id,
      targetEmail: result.account.email,
      metadata: { agencyId: result.account.agency_id, endsAt: result.account.ends_at },
      request,
    });
    return json({ ok: true, account: { id: result.account.id, email: result.account.email }, username: result.username, password: result.password, signInUrl: result.signInUrl }, 201);
  } catch (error) {
    return adminErrorResponse("test-accounts", error);
  }
}

export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsed = await parseBody(request, ActionInput, { allowEmpty: true });
    if (parsed.response) return parsed.response;
    const body = parsed.body;
    const accountId = cleanUuid(body.id);
    if (!accountId) return json({ error: "A valid test account id is required." }, 400);
    const supabase = getAdminSupabase();
    const account = await loadAccount(supabase, accountId);
    if (!account) return json({ error: "Test account not found." }, 404);

    const action = String(body.action || "");
    const result = await applyTestAccountAction({ client: await clerkClient(), supabase, account, action, body });
    if (result?.error) return json({ error: result.error }, result.status);

    await writeAdminAudit({
      adminUsername: admin.username,
      action: `test_account_${action}`,
      targetType: "test_account",
      targetId: account.id,
      targetEmail: account.email,
      metadata: action === "reset_password" ? { credentialChanged: true } : { days: body.days ?? null, cap: body.cap ?? null },
      request,
    });
    return json({ ok: true, ...(result?.password ? { password: result.password } : {}) });
  } catch (error) {
    return adminErrorResponse("test-accounts", error);
  }
}

export async function DELETE(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const parsed = await parseBody(request, DeleteInput, { allowEmpty: true });
    if (parsed.response) return parsed.response;
    const accountId = cleanUuid(parsed.body.id);
    if (!accountId) return json({ error: "A valid test account id is required." }, 400);
    const supabase = getAdminSupabase();
    const account = await loadAccount(supabase, accountId);
    if (!account || account.deleted_at) return json({ error: "Test account not found." }, 404);

    await deleteTestAccount({ client: await clerkClient(), supabase, account });
    await writeAdminAudit({
      adminUsername: admin.username,
      action: "test_account_delete",
      targetType: "test_account",
      targetId: account.id,
      targetEmail: account.email,
      metadata: { agencyId: account.agency_id },
      request,
    });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("test-accounts", error);
  }
}
