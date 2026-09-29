-- GDPR follow-ups (storage limitation, staff privacy).
--
-- candidates.talent_pool_expires_at  when a talent pool entry lapses unless
--                                    someone extends it; the retention job
--                                    takes expired entries out of the pool
-- profiles.presence_hidden           the person has chosen not to share
--                                    their presence with the team
--
-- Agency-wide choices (candidate retention period, whether presence is on
-- at all) live in agencies.settings: retention_months, presence_enabled.

alter table public.candidates
  add column if not exists talent_pool_expires_at timestamptz;

-- Existing pool entries get the default 12 months from when they were saved.
update public.candidates
  set talent_pool_expires_at = talent_pool_at + interval '12 months'
  where talent_pool_at is not null and talent_pool_expires_at is null;

alter table public.profiles
  add column if not exists presence_hidden boolean not null default false;

-- The retention job looks for candidates by agency and last activity.
create index if not exists candidates_agency_activity_idx
  on public.candidates (agency_id, (coalesce(last_activity_at, created_at)));
