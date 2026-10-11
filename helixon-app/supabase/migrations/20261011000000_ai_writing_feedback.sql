-- Recruiters' verdicts on the amber "possibly AI-written" notice ("Does this
-- look right?" - components/dashboard/AiWritingNotice.jsx), so its false
-- alarm rate can be measured. Stored with the other research signals:
-- label = 'right' | 'wrong', meta = { candidateId }.
alter table public.research_signals drop constraint if exists research_signals_kind_check;
alter table public.research_signals
  add constraint research_signals_kind_check
  check (kind in ('cancellation_reason', 'assistant_question', 'pulse_survey', 'research_optin', 'ai_writing_feedback'));
