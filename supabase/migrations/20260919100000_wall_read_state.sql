-- Track the latest wall message timestamp each user has seen.
-- A new user starts counting from the moment this row is created.
create table if not exists public.wall_read_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wall_read_state_last_read_at_idx
  on public.wall_read_state (last_read_at);

alter table public.wall_read_state enable row level security;

drop policy if exists "wall_read_state_select_own" on public.wall_read_state;
create policy "wall_read_state_select_own"
  on public.wall_read_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "wall_read_state_insert_own" on public.wall_read_state;
create policy "wall_read_state_insert_own"
  on public.wall_read_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "wall_read_state_update_own" on public.wall_read_state;
create policy "wall_read_state_update_own"
  on public.wall_read_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
