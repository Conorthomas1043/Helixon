import { getAdminSupabase } from "@/lib/admin-supabase";

export async function writeAdminAudit({
  adminUsername,
  action,
  targetType = null,
  targetId = null,
  targetEmail = null,
  metadata = {},
  request = null,
}) {
  if (!adminUsername) {
    throw new Error("adminUsername is required");
  }

  if (!action) {
    throw new Error("action is required");
  }

  const supabase = getAdminSupabase();

  const forwardedFor = request?.headers?.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request?.headers?.get("x-real-ip") ||
    null;

  const userAgent =
    request?.headers?.get("user-agent") || null;

  // admin_audit_logs.target_id is a uuid column. Targets that aren't uuids -
  // Clerk user ids ("user_2abc..."), IP addresses - used to make the insert
  // fail *after* the action had already happened, so the admin saw a 500 for a
  // change that had gone through. Those identifiers are kept in metadata
  // instead and target_id is left empty.
  const uuidTarget =
    typeof targetId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
      ? targetId
      : null;

  const baseMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};

  const finalMetadata =
    targetId && !uuidTarget
      ? { ...baseMetadata, targetRef: String(targetId).slice(0, 200) }
      : baseMetadata;

  const { error } = await supabase
    .from("admin_audit_logs")
    .insert({
      admin_username: String(adminUsername).slice(0, 64),
      action: String(action).slice(0, 80),
      target_type: targetType ? String(targetType).slice(0, 80) : null,
      target_id: uuidTarget,
      target_email: targetEmail ? String(targetEmail).slice(0, 254) : null,
      metadata: finalMetadata,
      ip: ip ? String(ip).slice(0, 64) : null,
      user_agent: userAgent ? String(userAgent).slice(0, 400) : null,
    });

  if (error) {
    throw new Error(
      `Failed to write admin audit log: ${error.message}`
    );
  }

  return { ok: true };
}

// For use AFTER a privileged action has already been carried out. If the audit
// row can't be written, the action still happened, so answering the request
// with a 500 would mislead the admin (and invite a retry of, say, a delete).
// This logs loudly instead and returns { ok: false } so the caller can flag it.
export async function writeAdminAuditSafe(entry) {
  try {
    return await writeAdminAudit(entry);
  } catch (error) {
    console.error(
      `[admin-audit] COULD NOT RECORD "${entry?.action}" by "${entry?.adminUsername}":`,
      error?.message || error
    );
    return { ok: false };
  }
}
