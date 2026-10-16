-- Staff-portal sessions are now stored as a SHA-256 of their token
-- (lib/employee/auth.js sessionTokenHash): the browser's cookie holds the
-- token, the table only its hash, so a copy of the table can't be replayed
-- as a signed-in session.
--
-- Rows written before that change hold the token itself. They no longer
-- match any cookie (a cookie is looked up by its hash), so they are dead,
-- but they are still live credentials in any copy of the table until they
-- expire. This removes the expired ones; anything still unexpired from
-- before the change runs out within its 12-hour limit and is removed the
-- next time this kind of cleanup runs. Safe to run more than once.
delete from public.employee_sessions
 where expires_at < now();
