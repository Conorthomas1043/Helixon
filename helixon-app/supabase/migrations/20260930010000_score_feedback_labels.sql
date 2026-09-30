-- Recruiter labels for scoring calibration. The "Does this match your
-- read?" card on an analysis now also asks which band the candidate belongs
-- in; a thumbs up records the band Helixon gave. scripts/fit-score-weights.mjs
-- and scripts/eval-labelled.mjs read these (with pipeline outcomes) to check
-- and tune the scoring weights. Additive only.

alter table public.feedback
  add column if not exists expected_band text;

alter table public.feedback drop constraint if exists feedback_expected_band_check;
alter table public.feedback
  add constraint feedback_expected_band_check
  check (expected_band is null or expected_band in ('Strong match', 'Worth reviewing', 'Not suitable'));

create index if not exists feedback_score_id_idx on public.feedback (score_id) where score_id is not null;
