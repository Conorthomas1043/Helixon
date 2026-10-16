-- Staff-portal sessions: store only a SHA-256 of each session token, as hex
-- (lib/employee/auth.js sessionTokenHash). The browser's cookie still holds
-- the token itself; a copy of this table can no longer be replayed as one.
-- Hashes the tokens of sessions already open, so they keep working once the
-- code that looks sessions up by hash is deployed. Run once: running it again
-- would hash the hashes and sign every employee out (harmless, they sign in
-- again).
update public.employee_sessions
   set token = encode(sha256(convert_to(token, 'UTF8')), 'hex')
 where token is not null;
