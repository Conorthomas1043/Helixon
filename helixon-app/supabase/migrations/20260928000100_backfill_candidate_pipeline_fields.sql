-- Candidates analysed before the /api/run fix never got their pipeline
-- fields: a stray `status` column in the follow-up update made it fail
-- every time, so they have stage/match_score/job_id all NULL and never
-- appear on the pipeline board, dashboard funnel or job pages.
--
-- Each of them still has its analysis in `scores`, so copy the latest
-- score's match/recommendation/job across and start them at "Screened" -
-- exactly what /api/run now writes for a new analysis.

WITH latest AS (
  SELECT DISTINCT ON (candidate_id)
    candidate_id, match_score, recommendation, job_id
  FROM public.scores
  WHERE candidate_id IS NOT NULL
  ORDER BY candidate_id, created_at DESC
)
UPDATE public.candidates c
SET
  stage          = 'Screened',
  match_score    = COALESCE(c.match_score, LEAST(GREATEST(latest.match_score, 0), 100)),
  recommendation = COALESCE(c.recommendation, latest.recommendation),
  job_id         = COALESCE(c.job_id, latest.job_id)
FROM latest
WHERE latest.candidate_id = c.id
  AND c.stage IS NULL
  AND c.processing_status = 'completed';

-- Completed candidates with no score row at all still belong on the board.
UPDATE public.candidates
SET stage = 'Screened'
WHERE stage IS NULL AND processing_status = 'completed';
