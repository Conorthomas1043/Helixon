-- Deeper candidate search.
--
-- candidates.search_vector   full-text index over name, current title and
--                            employer, location, skills and the CV text, for
--                            boolean search (lib/boolean-search.js). Names
--                            use the 'simple' config (no stemming); the rest
--                            'english'.
-- candidates.lat / lng       where their location is, for radius search
--                            (filled in by app/api/cron/geocode from
--                            postcodes.io; geocode_query is the text that was
--                            looked up, so a changed location is redone)
-- geocode_cache              place text -> coordinates, so each town is only
--                            looked up once
-- saved_searches             a recruiter's saved Candidates filters ("smart
--                            lists"), optionally shared with the team and
--                            with a daily email of new matches
--
-- Agency foreign keys don't cascade - see 20261001090000.

alter table public.candidates
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(current_title, '') || ' ' || coalesce(current_company, '')), 'B')
    || setweight(to_tsvector('english', coalesce(location, '') || ' ' || coalesce(extracted ->> 'skills', '')), 'B')
    || setweight(to_tsvector('english', left(coalesce(cv_text, ''), 200000)), 'D')
  ) stored;

create index if not exists candidates_search_vector_idx on public.candidates using gin (search_vector);

alter table public.candidates
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_query text;

create index if not exists candidates_agency_lat_lng_idx on public.candidates (agency_id, lat, lng) where lat is not null;

create table if not exists public.geocode_cache (
  query       text primary key check (char_length(query) <= 200),
  lat         double precision,
  lng         double precision,
  found       boolean not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id),
  user_id          text not null,
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  params           jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  shared           boolean not null default false,
  alert            boolean not null default false,
  last_alerted_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists saved_searches_agency_id_idx on public.saved_searches (agency_id);
create index if not exists saved_searches_alert_idx on public.saved_searches (agency_id) where alert;

alter table public.geocode_cache enable row level security;
alter table public.saved_searches enable row level security;

comment on table public.geocode_cache is 'Service-role only. Place names looked up for radius search (lib/geocode.js).';
comment on table public.saved_searches is 'Service-role only. Agency scoping enforced in the Next.js API layer, not RLS.';
