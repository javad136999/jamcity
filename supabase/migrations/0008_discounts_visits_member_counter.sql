-- ============================================================
-- جم‌سیتی — Product discounts, site visit analytics, and a
-- wall member counter (starts random 1000-2000, grows by 1 for
-- every real new signup).
-- Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. business_products: discount percentage
-- ------------------------------------------------------------
alter table public.business_products
  add column if not exists discount_percent int
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

create index if not exists business_products_discount_idx
  on public.business_products (discount_percent)
  where discount_percent is not null;

-- ------------------------------------------------------------
-- 2. site_visits: lightweight pageview/session tracking for the
--    admin analytics panel (day/month/year counts).
-- ------------------------------------------------------------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now(),
  path text
);

create index if not exists site_visits_visited_at_idx on public.site_visits (visited_at);

alter table public.site_visits enable row level security;

-- Anyone (including anonymous visitors) can log a visit.
drop policy if exists "site_visits_insert_anyone" on public.site_visits;
create policy "site_visits_insert_anyone"
  on public.site_visits for insert
  with check (true);

-- Only the admin can read the raw visit log.
drop policy if exists "site_visits_select_admin" on public.site_visits;
create policy "site_visits_select_admin"
  on public.site_visits for select
  using ((auth.jwt() ->> 'email') = 'exina30@gmail.com');

-- ------------------------------------------------------------
-- 3. site_stats: single-row table holding the "fake" wall member
--    counter. Seeded once with a random number between 1000-2000,
--    then incremented by 1 automatically for every real profile
--    that gets created (handle_new_profile_growth trigger).
-- ------------------------------------------------------------
create table if not exists public.site_stats (
  id int primary key default 1,
  member_count int not null,
  constraint site_stats_singleton check (id = 1)
);

insert into public.site_stats (id, member_count)
values (1, 1000 + floor(random() * 1001)::int)
on conflict (id) do nothing;

alter table public.site_stats enable row level security;

drop policy if exists "site_stats_select_all" on public.site_stats;
create policy "site_stats_select_all"
  on public.site_stats for select
  using (true);

create or replace function public.grow_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.site_stats set member_count = member_count + 1 where id = 1;
  return new;
end;
$$;

drop trigger if exists on_profile_created_grow_count on public.profiles;
create trigger on_profile_created_grow_count
  after insert on public.profiles
  for each row
  execute function public.grow_member_count();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_stats'
  ) then
    alter publication supabase_realtime add table public.site_stats;
  end if;
end $$;
