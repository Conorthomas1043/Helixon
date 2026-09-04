-- Shared (team-visible) to-dos and onboarding progress for the employee
-- portal (app/employee/*). Deliberately scoped to public.employees(id),
-- NOT auth.users(id) - employees authenticate through the app's own
-- session system (lib/employee-auth.js, employee_sessions table), they are
-- not Supabase Auth users. The earlier todo_lists/shared_todos tables
-- (see 20260903_shared_ops_security.sql) reference auth.users and were
-- never reachable from the employee dashboard as a result - this
-- replaces that dead path with one that matches how employees actually
-- authenticate.
--
-- This app talks to Supabase with the service-role key (see lib/supabase.js),
-- which bypasses RLS entirely, so - same as employee_todos - every query
-- against these tables must filter by employee_id/created_by/assigned_to
-- explicitly in application code (see lib/employee-shared-todos.js and
-- lib/employee-onboarding.js). RLS is still enabled below as defence in
-- depth in case a client ever queries these tables directly.

create table if not exists public.employee_shared_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  done boolean not null default false,
  created_by uuid not null references public.employees(id) on delete cascade,
  assigned_to uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_shared_todos_created_by on public.employee_shared_todos(created_by);
create index if not exists idx_employee_shared_todos_assigned_to on public.employee_shared_todos(assigned_to);
create index if not exists idx_employee_shared_todos_done on public.employee_shared_todos(done);

alter table public.employee_shared_todos enable row level security;

-- No policies defined for the anon/authenticated roles - this table is only
-- ever reached through the service-role key from server routes, which
-- bypasses RLS by design. Enabling RLS with no policies just means a
-- misconfigured client-side Supabase call gets nothing back, rather than
-- everything.

-- ── Onboarding ────────────────────────────────────────────────────────────
-- The checklist itself (task keys, labels, order) lives in code
-- (lib/onboarding-tasks.js) since it changes rarely and doesn't need its
-- own admin UI yet. This table only tracks which task_keys a given
-- employee has completed, and when.

create table if not exists public.employee_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 80),
  completed_at timestamptz not null default now(),
  unique (employee_id, task_key)
);

create index if not exists idx_employee_onboarding_progress_employee_id on public.employee_onboarding_progress(employee_id);

alter table public.employee_onboarding_progress enable row level security;
