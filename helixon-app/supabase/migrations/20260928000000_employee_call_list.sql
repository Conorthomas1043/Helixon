-- Shared "who to call" list for the sales team's cold calls. Rows come in
-- from a CSV import on /employee/cold-calls; everyone sees the whole list
-- with numbers, can claim a contact so two people don't ring the same
-- person, and logging a call against a row marks it done (linking the
-- employee_cold_calls entry). See lib/employee-call-list.js.
--
-- Accessed only through the service-role client in the API routes, like the
-- other employee_* tables, so RLS is enabled with no policies.

CREATE TABLE IF NOT EXISTS public.employee_call_list (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name  text,
  company       text,
  phone         text NOT NULL,
  email         text,
  notes         text,
  batch_label   text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  claimed_by    uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  claimed_at    timestamptz,
  completed_by  uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  completed_at  timestamptz,
  cold_call_id  uuid REFERENCES public.employee_cold_calls(id) ON DELETE SET NULL,
  uploaded_by   uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_call_list_status_idx ON public.employee_call_list (status, created_at);

ALTER TABLE public.employee_call_list ENABLE ROW LEVEL SECURITY;
