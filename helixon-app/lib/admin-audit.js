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

  const { error } = await supabase
    .from("admin_audit_logs")
    .insert({
      admin_username: String(adminUsername),
      action: String(action),
      target_type: targetType ? String(targetType) : null,
      target_id: targetId || null,
      target_email: targetEmail ? String(targetEmail) : null,
      metadata:
        metadata && typeof metadata === "object"
          ? metadata
          : {},
      ip,
      user_agent: userAgent,
    });

  if (error) {
    throw new Error(
      `Failed to write admin audit log: ${error.message}`
    );
  }

  return { ok: true };
}