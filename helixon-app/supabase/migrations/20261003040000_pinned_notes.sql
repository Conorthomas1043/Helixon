-- Pinned notes: a pinned note stays at the top of a candidate's notes
-- (anyone in the agency can pin or unpin one).

alter table public.candidate_notes
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by text check (pinned_by is null or char_length(pinned_by) <= 64);
