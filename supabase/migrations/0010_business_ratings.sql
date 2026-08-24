-- ============================================================
-- جم‌سیتی — امتیازدهی ستاره‌ای (۱ تا ۵) به کسب‌وکارها. هر کاربر
-- فقط یک امتیاز برای هر کسب‌وکار دارد (با ثبت مجدد آپدیت می‌شود).
-- میانگین و تعداد امتیازها روی جدول businesses کش می‌شود تا روی
-- آیکون نقشه نمایش داده شود.
-- Safe to run multiple times.
-- ============================================================

create table if not exists public.business_ratings (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.business_ratings enable row level security;

drop policy if exists "business_ratings_select_all" on public.business_ratings;
create policy "business_ratings_select_all"
  on public.business_ratings for select
  using (true);

drop policy if exists "business_ratings_insert_own" on public.business_ratings;
create policy "business_ratings_insert_own"
  on public.business_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "business_ratings_update_own" on public.business_ratings;
create policy "business_ratings_update_own"
  on public.business_ratings for update
  using (auth.uid() = user_id);

alter table public.businesses
  add column if not exists rating_avg numeric not null default 0,
  add column if not exists rating_count int not null default 0;

create or replace function public.refresh_business_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.business_id, old.business_id);

  update public.businesses b
  set
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.business_ratings r where r.business_id = target_id), 0),
    rating_count = (select count(*) from public.business_ratings r where r.business_id = target_id)
  where b.id = target_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_business_rating_upsert on public.business_ratings;
create trigger on_business_rating_upsert
  after insert or update or delete on public.business_ratings
  for each row
  execute function public.refresh_business_rating();
