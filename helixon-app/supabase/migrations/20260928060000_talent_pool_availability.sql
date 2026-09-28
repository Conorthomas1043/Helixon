-- Talent pool: where each saved person stands, and when to get back in
-- touch.
--
-- talent_pool_status     available | open (open to offers) | not_looking,
--                        or null when unknown
-- talent_pool_check_in   the date to check in with them again

alter table public.candidates
  add column if not exists talent_pool_status text,
  add column if not exists talent_pool_check_in date;

alter table public.candidates
  drop constraint if exists candidates_talent_pool_status_check;
alter table public.candidates
  add constraint candidates_talent_pool_status_check
  check (talent_pool_status is null or talent_pool_status in ('available', 'open', 'not_looking'));
