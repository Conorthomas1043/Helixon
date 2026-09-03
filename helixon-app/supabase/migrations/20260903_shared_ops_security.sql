-- Additive hardening for the shared employee operations layer.
-- Safe to run after the previously-created todo_lists/shared_todos tables.

create table if not exists public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_todos (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.todo_lists(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  completed boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shared_todos_created_by on public.shared_todos(created_by);
create index if not exists idx_shared_todos_assigned_to on public.shared_todos(assigned_to);
create index if not exists idx_shared_todos_due_at on public.shared_todos(due_at);
create index if not exists idx_shared_todos_list_id on public.shared_todos(list_id);

alter table public.todo_lists enable row level security;
alter table public.shared_todos enable row level security;

drop policy if exists "employee read own todo lists" on public.todo_lists;
drop policy if exists "employee create own todo lists" on public.todo_lists;
drop policy if exists "employee update own todo lists" on public.todo_lists;
drop policy if exists "employee delete own todo lists" on public.todo_lists;
create policy "employee read own todo lists" on public.todo_lists for select to authenticated using (created_by = auth.uid());
create policy "employee create own todo lists" on public.todo_lists for insert to authenticated with check (created_by = auth.uid());
create policy "employee update own todo lists" on public.todo_lists for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "employee delete own todo lists" on public.todo_lists for delete to authenticated using (created_by = auth.uid());

drop policy if exists "employee read permitted shared todos" on public.shared_todos;
drop policy if exists "employee create shared todos" on public.shared_todos;
drop policy if exists "employee update permitted shared todos" on public.shared_todos;
drop policy if exists "employee delete own shared todos" on public.shared_todos;
create policy "employee read permitted shared todos" on public.shared_todos for select to authenticated using (created_by = auth.uid() or assigned_to = auth.uid());
create policy "employee create shared todos" on public.shared_todos for insert to authenticated with check (created_by = auth.uid());
create policy "employee update permitted shared todos" on public.shared_todos for update to authenticated using (created_by = auth.uid() or assigned_to = auth.uid()) with check (created_by = auth.uid() or assigned_to = auth.uid());
create policy "employee delete own shared todos" on public.shared_todos for delete to authenticated using (created_by = auth.uid());
