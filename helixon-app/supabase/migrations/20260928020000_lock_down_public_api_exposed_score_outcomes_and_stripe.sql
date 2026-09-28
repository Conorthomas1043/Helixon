-- SECURITY FIX (critical): score_outcomes (a SECURITY DEFINER view over
-- scores/candidates/feedback) and the `stripe` foreign table were both
-- granted full privileges to anon and authenticated. The anon key is public
-- (shipped to the browser as NEXT_PUBLIC_SUPABASE_ANON_KEY), so anyone could
-- read every agency's candidate scores/PII/feedback via GET /rest/v1/
-- score_outcomes (the SECURITY DEFINER view bypassed the underlying tables'
-- RLS), and read live Stripe data via /rest/v1/stripe (foreign tables ignore
-- RLS). Verified live: the anon role could read 126 score rows across 2
-- agencies before this ran. Neither object is used by the app (all app DB
-- access is via the service-role key), so locking them to service-role only
-- changes nothing for the app while closing the hole.

-- Make the view run with the querying role's own permissions + RLS, so it can
-- never again bypass row-level security even if it is somehow re-granted.
alter view public.score_outcomes set (security_invoker = on);

revoke all on public.score_outcomes from anon, authenticated;
revoke all on public.stripe          from anon, authenticated;

comment on view public.score_outcomes is
  'Service-role only (security_invoker). Was exposed to anon/authenticated and bypassed RLS as a SECURITY DEFINER view - locked down; see migration lock_down_public_api_exposed_score_outcomes_and_stripe.';
