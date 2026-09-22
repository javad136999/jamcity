-- جم‌سیتی — Web Push subscriptions for weekly city-news notifications.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (enabled);

create index if not exists push_subscriptions_last_sent_idx
  on public.push_subscriptions (last_sent_at);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_insert_public" on public.push_subscriptions;
create policy "push_subscriptions_insert_public"
  on public.push_subscriptions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "push_subscriptions_update_public" on public.push_subscriptions;
create policy "push_subscriptions_update_public"
  on public.push_subscriptions
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "push_subscriptions_select_none" on public.push_subscriptions;
create policy "push_subscriptions_select_none"
  on public.push_subscriptions
  for select
  to anon, authenticated
  using (false);

drop policy if exists "push_subscriptions_delete_none" on public.push_subscriptions;
create policy "push_subscriptions_delete_none"
  on public.push_subscriptions
  for delete
  to anon, authenticated
  using (false);

notify pgrst, 'reload schema';
