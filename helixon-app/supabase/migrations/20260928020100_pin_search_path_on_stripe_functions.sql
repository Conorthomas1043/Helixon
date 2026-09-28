-- Hardening (advisor function_search_path_mutable): pin an empty search_path
-- so these SECURITY-relevant helpers can't be hijacked by a caller who has
-- created a same-named object in a schema earlier on their search_path.
alter function stripe.set_updated_at() set search_path = '';
alter function stripe.set_updated_at_metadata() set search_path = '';
alter function stripe.check_rate_limit(text, integer, integer) set search_path = '';
