-- /api/run never wrote candidates.match_summary / strengths / concerns, so
-- the candidate profile's "Why they match" said "None recorded" and "No
-- concerns flagged" for every candidate - even when the analysis had found
-- red flags. /api/run now writes them (lib/analysis-report.js
-- matchHighlights); this fills them in for candidates already screened, from
-- each one's latest analysis. Only empty columns are touched.
--
-- Mirrors matchHighlights: concerns are red flags first, then weaknesses;
-- items may be strings or small objects; duplicates dropped; 8 max each.

with latest as (
  select distinct on (candidate_id) candidate_id, result
  from public.scores
  where result is not null
  order by candidate_id, created_at desc
),
items as (
  select l.candidate_id,
         nullif(trim(l.result->>'summary'), '') as summary,
         (
           select array_agg(t order by ord) from (
             select distinct on (lower(t)) t, ord from (
               select trim(case jsonb_typeof(e) when 'string' then e #>> '{}'
                        else coalesce(e->>'flag', e->>'title', e->>'description', e->>'detail', e->>'text', e->>'reason') end) as t,
                      ord
               from jsonb_array_elements(coalesce(l.result->'strengths', '[]'::jsonb)) with ordinality as x(e, ord)
             ) s where t is not null and t <> '' order by lower(t), ord
           ) d where ord is not null
         ) as strengths,
         (
           select array_agg(t order by grp, ord) from (
             select distinct on (lower(t)) t, grp, ord from (
               select trim(case jsonb_typeof(e) when 'string' then e #>> '{}'
                        else coalesce(e->>'flag', e->>'title', e->>'description', e->>'detail', e->>'text', e->>'reason') end) as t,
                      1 as grp, ord
               from jsonb_array_elements(coalesce(l.result->'red_flags', '[]'::jsonb)) with ordinality as x(e, ord)
               union all
               select trim(case jsonb_typeof(e) when 'string' then e #>> '{}'
                        else coalesce(e->>'flag', e->>'title', e->>'description', e->>'detail', e->>'text', e->>'reason') end),
                      2, ord
               from jsonb_array_elements(coalesce(l.result->'weaknesses', '[]'::jsonb)) with ordinality as x(e, ord)
             ) s where t is not null and t <> '' order by lower(t), grp, ord
           ) d
         ) as concerns
  from latest l
)
update public.candidates c
set match_summary = coalesce(nullif(c.match_summary, ''), left(i.summary, 2000)),
    strengths = case when coalesce(array_length(c.strengths, 1), 0) = 0 then i.strengths[1:8] else c.strengths end,
    concerns  = case when coalesce(array_length(c.concerns, 1), 0) = 0 then i.concerns[1:8] else c.concerns end
from items i
where i.candidate_id = c.id
  and (nullif(c.match_summary, '') is null
       or coalesce(array_length(c.strengths, 1), 0) = 0
       or coalesce(array_length(c.concerns, 1), 0) = 0);
