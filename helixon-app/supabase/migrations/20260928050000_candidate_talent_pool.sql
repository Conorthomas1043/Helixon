-- Talent pool: candidates an agency wants to keep for future roles.
--
-- talent_pool_at     when they were saved to the pool (null = not in it)
-- talent_pool_by     who saved them (display name)
-- talent_pool_note   why they're worth keeping ("great, but salary too high")
-- pooled_from_id     for a candidate row created by screening someone
--                    already on file against another job (no re-upload):
--                    the row whose CV it reused. Lets the app spot "already
--                    screened for this job" and list a person's other roles.
--
-- candidates keeps its existing RLS (no client policies; the server uses the
-- service role), so the new columns are covered by it.

alter table public.candidates
  add column if not exists talent_pool_at timestamptz,
  add column if not exists talent_pool_by text,
  add column if not exists talent_pool_note text,
  add column if not exists pooled_from_id uuid references public.candidates(id) on delete set null;

alter table public.candidates
  drop constraint if exists candidates_talent_pool_note_length;
alter table public.candidates
  add constraint candidates_talent_pool_note_length check (talent_pool_note is null or char_length(talent_pool_note) <= 500);

create index if not exists candidates_talent_pool_idx
  on public.candidates (agency_id, talent_pool_at desc)
  where talent_pool_at is not null;

create index if not exists candidates_pooled_from_idx
  on public.candidates (pooled_from_id)
  where pooled_from_id is not null;
