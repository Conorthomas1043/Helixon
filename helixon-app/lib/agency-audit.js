// The workspace's own audit log (agency_audit_log, migration
// 20261003020000): who deleted, exported or changed what. Shown to the
// owner and admins on /dashboard/settings/audit. logAudit() never throws -
// a log entry failing to save mustn't undo or block the action itself.

import { supabase } from "@/lib/supabase";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { getClientIp } from "@/lib/ratelimit";

export const AUDIT_ACTIONS = {
  "candidate.deleted": "Deleted candidates",
  "candidate.exported": "Exported a candidate's data",
  "candidate.merged": "Merged duplicate candidates",
  "candidates.exported": "Exported candidates to CSV",
  "team.invited": "Invited a teammate",
  "team.removed": "Removed a teammate",
  "team.role_changed": "Changed a teammate's role",
  "settings.permissions": "Changed permissions",
  "settings.privacy": "Changed privacy settings",
  "settings.invoicing": "Changed invoicing settings",
  "settings.performance": "Changed targets or commission",
  "settings.pipeline": "Changed pipeline stages",
  "api_key.created": "Created an API key",
  "api_key.revoked": "Revoked an API key",
  "webhook.created": "Added a webhook",
  "webhook.deleted": "Removed a webhook",
  "invoice.status": "Changed an invoice's status",
  "signature.withdrawn": "Withdrew a document from signature",
  "accounting.exported": "Exported invoices or payroll",
};

export async function logAudit({ auth, request = null, action, targetType = null, targetId = null, summary = null, meta = null }) {
  if (!auth?.agencyId || !action) return;
  try {
    const { error } = await supabase.from("agency_audit_log").insert({
      agency_id: auth.agencyId,
      actor_id: auth.userId || null,
      actor_name: (recruiterDisplayName(auth.profile) || "").slice(0, 200) || null,
      action: String(action).slice(0, 80),
      target_type: targetType,
      target_id: targetId ? String(targetId).slice(0, 64) : null,
      summary: summary ? String(summary).slice(0, 500) : null,
      meta,
      ip: request ? String(getClientIp(request) || "").slice(0, 100) || null : null,
    });
    if (error) console.warn("[agency-audit] Not saved:", error.message);
  } catch (err) {
    console.warn("[agency-audit] Not saved:", err.message);
  }
}
