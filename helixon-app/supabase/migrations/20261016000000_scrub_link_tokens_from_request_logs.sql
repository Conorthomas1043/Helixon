-- The private links (/share, /portal, /sign, /book, /reference, /scorecard,
-- /feedback and the calendar feeds) carry their token - the only credential
-- - in the path. edge-log stored paths, referers and redirect locations as
-- requested, so request_logs held live tokens. It now replaces them with
-- "[token]" before storing (lib/ops/request-capture.js redactPath); this
-- does the same to rows already there. The tokens are 32+ hex characters;
-- UUIDs and slugs never have a hex run that long.
update public.request_logs
   set path = regexp_replace(path, '[A-Fa-f0-9]{32,}', '[token]', 'g')
 where path ~ '[A-Fa-f0-9]{32,}';

update public.request_logs
   set referer = regexp_replace(referer, '[A-Fa-f0-9]{32,}', '[token]', 'g')
 where referer ~ '[A-Fa-f0-9]{32,}';

update public.request_logs
   set location = regexp_replace(location, '[A-Fa-f0-9]{32,}', '[token]', 'g')
 where location ~ '[A-Fa-f0-9]{32,}';
