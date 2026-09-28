-- Moves a user who accepted a team invite into the inviting agency, bringing
-- their old solo workspace's data with them - in one transaction, so either
-- everything moves or nothing does.
--
-- Before this, the Clerk webhook (app/api/webhooks/clerk) only re-pointed
-- profiles.agency_id. Anything in their old workspace - candidates, jobs,
-- scores, notes, drafts, feedback links - stayed attached to an agency nobody
-- belonged to any more, so it was effectively lost.
--
-- Only ever called for a workspace the webhook has already judged safe to
-- empty (canMoveToInvitingAgency: no other members, no active subscription).
-- Both are re-checked here under lock, so a change between that check and
-- this call can't pull someone out of a shared or paid workspace.
--
-- Legacy pre-Clerk tables (recruiters, users, trial_verifications) are left
-- alone. The old agency row is removed if nothing references it any more.
-- CV files don't move: their storage path is stored per candidate
-- (candidates.cv_file_url), so they keep working from the new agency.

create or replace function public.move_member_into_agency(
  p_profile_id uuid,
  p_from uuid,
  p_to uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  moved jsonb := '{}'::jsonb;
  n bigint;
  t text;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'move_member_into_agency: invalid agencies';
  end if;

  -- Serialise against anything else touching either agency row.
  perform 1 from public.agencies where id in (p_from, p_to) order by id for update;

  if not exists (select 1 from public.profiles where id = p_profile_id and agency_id = p_from) then
    raise exception 'move_member_into_agency: profile is not in the source agency';
  end if;
  if not exists (select 1 from public.agencies where id = p_to) then
    raise exception 'move_member_into_agency: target agency not found';
  end if;
  if exists (select 1 from public.profiles where agency_id = p_from and id <> p_profile_id) then
    raise exception 'move_member_into_agency: source agency has other members';
  end if;
  if exists (select 1 from public.subscriptions where user_id = p_profile_id and status = 'active') then
    raise exception 'move_member_into_agency: source agency has an active subscription';
  end if;

  foreach t in array array[
    'jobs', 'candidates', 'scores', 'analyses', 'artifacts', 'candidate_notes',
    'feedback', 'feedback_requests', 'job_channels', 'job_templates', 'shortlists'
  ] loop
    execute format('update public.%I set agency_id = $1 where agency_id = $2', t) using p_to, p_from;
    get diagnostics n = row_count;
    moved := moved || jsonb_build_object(t, n);
  end loop;

  update public.profiles set agency_id = p_to where id = p_profile_id;

  -- Drop the now-empty agency. Inside its own block: if a legacy table still
  -- references it, keep the row rather than failing the whole move.
  begin
    delete from public.agencies where id = p_from;
  exception when foreign_key_violation then
    moved := moved || jsonb_build_object('old_agency_kept', true);
  end;

  return moved;
end;
$$;

-- Server-side only (the Clerk webhook, via the service-role key).
revoke all on function public.move_member_into_agency(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_member_into_agency(uuid, uuid, uuid) to service_role;
