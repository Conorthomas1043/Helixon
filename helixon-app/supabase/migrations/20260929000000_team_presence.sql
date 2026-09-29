-- Team presence on the Team page: who's online, busy or away, and when
-- anyone offline was last active.
--
-- last_seen_at       last heartbeat from an open Helixon tab (lib/presence)
-- last_active_at     last time they actually used it (typed, clicked,
--                    scrolled) - online but idle is shown as "Idle"
-- presence_status    set by the person: 'busy' or 'away' (null = automatic)
-- presence_message   what they're doing, e.g. "Client interviews"
-- presence_until     when a busy/away status clears itself (null = until
--                    they change it)
--
-- profiles keeps its existing RLS (no client policies; the server reads and
-- writes it with the service role).

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists presence_status text,
  add column if not exists presence_message text,
  add column if not exists presence_until timestamptz;

alter table public.profiles drop constraint if exists profiles_presence_status_check;
alter table public.profiles
  add constraint profiles_presence_status_check check (presence_status is null or presence_status in ('busy', 'away'));

alter table public.profiles drop constraint if exists profiles_presence_message_length;
alter table public.profiles
  add constraint profiles_presence_message_length check (presence_message is null or char_length(presence_message) <= 80);
