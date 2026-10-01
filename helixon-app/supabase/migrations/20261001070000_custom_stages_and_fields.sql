-- An agency's own pipeline sub-stages and custom fields (lib/custom-fields.js).
--
-- The definitions live in agencies.settings.customisation; this adds where
-- the values go:
--   candidates.sub_stage      the agency's sub-stage within the core stage
--                             ("2nd interview" within Interview)
--   <table>.custom_fields     { fieldId: value } on candidates, jobs, clients

alter table public.candidates
  add column if not exists sub_stage text check (sub_stage is null or char_length(sub_stage) <= 40),
  add column if not exists custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object');

alter table public.jobs
  add column if not exists custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object');

alter table public.clients
  add column if not exists custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object');

create index if not exists candidates_sub_stage_idx on public.candidates (agency_id, sub_stage) where sub_stage is not null;
