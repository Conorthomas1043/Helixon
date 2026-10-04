// Tables with an agency_id that stay service-role only (identity, secrets,
// the audit log, research data). Must match the migration's exclusion list;
// supabase/agency-rls.test.js checks both.
export const AGENCY_RLS_EXCLUDED = new Set([
  "profiles",
  "api_keys",
  "webhook_endpoints",
  "integration_connections",
  "member_tokens",
  "agency_audit_log",
  "research_signals",
]);
