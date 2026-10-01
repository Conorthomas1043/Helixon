-- Inbound applicants. Agencies can publish jobs to a public jobs page
-- (/jobs/<careers_slug>) where people apply with their CV; applications are
-- screened like an upload and land in the pipeline with their source.
--
-- agencies.careers_*    the public jobs page: its address, whether it's on,
--                       and an intro paragraph
-- jobs.published ...    whether a job is advertised, and how: its public
--                       description (the internal job_text often names the
--                       client or has notes), and whether to show the client
--                       and salary
-- candidates.source_detail   where an applicant came from beyond the
--                       source bucket (e.g. "indeed", "linkedin-post")
-- candidates.applied_at, consent_given_at, consent_source
--                       when they applied and agreed to the privacy notice
--
-- New source/channel value "careers_page" for people who applied directly.

alter table public.agencies
  add column if not exists careers_slug text,
  add column if not exists careers_enabled boolean not null default false,
  add column if not exists careers_intro text,
  add column if not exists careers_website text;

alter table public.agencies drop constraint if exists agencies_careers_slug_format;
alter table public.agencies
  add constraint agencies_careers_slug_format
  check (careers_slug is null or careers_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');
alter table public.agencies drop constraint if exists agencies_careers_intro_length;
alter table public.agencies
  add constraint agencies_careers_intro_length check (careers_intro is null or char_length(careers_intro) <= 2000);
alter table public.agencies drop constraint if exists agencies_careers_website_length;
alter table public.agencies
  add constraint agencies_careers_website_length check (careers_website is null or char_length(careers_website) <= 300);
create unique index if not exists agencies_careers_slug_key on public.agencies (careers_slug) where careers_slug is not null;

alter table public.jobs
  add column if not exists published boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists public_title text,
  add column if not exists public_description text,
  add column if not exists hide_client boolean not null default true,
  add column if not exists show_salary boolean not null default true;

alter table public.jobs drop constraint if exists jobs_public_text_length;
alter table public.jobs
  add constraint jobs_public_text_length
  check ((public_title is null or char_length(public_title) <= 200) and (public_description is null or char_length(public_description) <= 20000));
create index if not exists jobs_published_idx on public.jobs (agency_id, published_at desc) where published;

alter table public.candidates
  add column if not exists source_detail text,
  add column if not exists applied_at timestamptz,
  add column if not exists consent_given_at timestamptz,
  add column if not exists consent_source text;

alter table public.candidates drop constraint if exists candidates_source_detail_length;
alter table public.candidates
  add constraint candidates_source_detail_length
  check ((source_detail is null or char_length(source_detail) <= 100) and (consent_source is null or char_length(consent_source) <= 100));

-- "careers_page" joins the source / channel vocabularies.
alter table public.candidates drop constraint if exists candidates_source_check;
alter table public.candidates
  add constraint candidates_source_check
  check (source is null or source = any (array['referral', 'job_board', 'linkedin', 'direct_sourcing', 'agency_database', 'careers_page', 'other']));

alter table public.job_channels drop constraint if exists job_channels_channel_check;
alter table public.job_channels
  add constraint job_channels_channel_check
  check (channel = any (array['referral', 'job_board', 'linkedin', 'direct_sourcing', 'agency_database', 'careers_page', 'other']));
