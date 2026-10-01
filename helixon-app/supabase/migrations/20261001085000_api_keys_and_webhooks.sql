-- The agency's own integrations: API keys for the REST API (/api/v1, also
-- used by the LinkedIn extension and Zapier) and outgoing webhooks.
--
-- api_keys            only a SHA-256 hash of each key is stored; the key
--                     itself is shown once when it's made. prefix is the
--                     first characters, to tell keys apart.
-- webhook_endpoints   URLs that get a signed POST when something happens
--                     (lib/webhooks.js); secret signs each delivery.
--
-- Agency foreign keys don't cascade - see 20261001090000.
-- Service-role only: RLS on, no policies.

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id),
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  prefix        text not null check (char_length(prefix) between 4 and 20),
  key_hash      text not null unique,
  created_by    text not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists api_keys_agency_id_idx on public.api_keys (agency_id);

create table if not exists public.webhook_endpoints (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id),
  url               text not null check (char_length(url) between 10 and 500),
  description       text check (description is null or char_length(description) <= 120),
  events            text[] not null default '{}',
  secret            text not null,
  active            boolean not null default true,
  last_status       integer,
  last_error        text check (last_error is null or char_length(last_error) <= 300),
  last_delivery_at  timestamptz,
  failure_count     integer not null default 0,
  created_by        text,
  created_at        timestamptz not null default now()
);

create index if not exists webhook_endpoints_agency_active_idx on public.webhook_endpoints (agency_id) where active;

alter table public.api_keys enable row level security;
alter table public.webhook_endpoints enable row level security;

comment on table public.api_keys is 'Service-role only. Hashed keys for /api/v1 (lib/api-keys.js).';
comment on table public.webhook_endpoints is 'Service-role only. secret signs deliveries (lib/webhooks.js).';
