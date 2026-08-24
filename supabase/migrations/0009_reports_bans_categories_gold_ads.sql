-- ============================================================
-- جم‌سیتی — دسته‌بندی آگهی دیوار (خودرو/املاک)، سیستم ریپورت و
-- مسدودسازی کاربر، و ارسال خودکار روزانه آگهی اشتراک طلایی
-- ساعت ۹ صبح (به وقت ایران) در دیوار شهر جم.
-- Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. wall_messages: دسته‌بندی اختیاری خودرو/املاک
-- ------------------------------------------------------------
alter table public.wall_messages
  add column if not exists category text
  check (category is null or category in ('car', 'realestate'));

create index if not exists wall_messages_category_idx
  on public.wall_messages (category)
  where category is not null;

-- ------------------------------------------------------------
-- 2. profiles: امکان مسدودسازی کاربر
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists banned boolean not null default false;

-- کاربر مسدود نتواند پیام جدید در دیوار یا چت خصوصی ثبت کند
-- (لایه‌ی دفاعی دوم؛ برنامه هم این را چک می‌کند).
drop policy if exists "wall_messages_insert_own" on public.wall_messages;
create policy "wall_messages_insert_own"
  on public.wall_messages for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned = true)
  );

drop policy if exists "messages_insert_participant" on public.private_messages;
create policy "messages_insert_participant"
  on public.private_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = private_messages.conversation_id
        and (c.user_one = auth.uid() or c.user_two = auth.uid())
    )
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned = true)
  );

-- ------------------------------------------------------------
-- 3. reports: گزارش تخلف کاربر (از دیوار یا چت خصوصی)
-- ------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  context text not null check (context in ('wall', 'chat')),
  message_content text,
  reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reports_resolved_idx on public.reports (resolved);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  using ((auth.jwt() ->> 'email') = 'exina30@gmail.com');

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  using ((auth.jwt() ->> 'email') = 'exina30@gmail.com');

-- Admin (by email) can ban/unban any profile.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (
    auth.uid() = id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  )
  with check (
    auth.uid() = id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  );

-- ------------------------------------------------------------
-- 4. ارسال خودکار روزانه آگهی کسب‌وکارهای اشتراک طلایی، ساعت
--    ۹ صبح به وقت ایران (۵:۳۰ UTC) — نیازمند فعال بودن pg_cron.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then

    perform cron.unschedule('jamcity-daily-gold-ads')
    where exists (select 1 from cron.job where jobname = 'jamcity-daily-gold-ads');

    perform cron.schedule(
      'jamcity-daily-gold-ads',
      '30 5 * * *',
      $cron$
        insert into public.wall_messages (user_id, content, image_url, is_promo, business_id)
        select
          b.owner_id,
          '🌟 آگهی ویژه اشتراک طلایی: ' || b.name || E'\n' ||
            coalesce(b.description, '') || E'\n' ||
            '📍 ' || b.address,
          b.image_url,
          true,
          b.id
        from public.businesses b
        where b.subscription_status = 'approved'
          and b.subscription_tier = 'gold'
          and b.owner_id is not null;
      $cron$
    );

  end if;
end $$;

-- ------------------------------------------------------------
-- 5. ایندکس کمکی برای فیلتر سریع‌تر دسته‌بندی کسب‌وکارهای تاییدشده
-- ------------------------------------------------------------
create index if not exists businesses_category_approved_idx
  on public.businesses (category)
  where subscription_status = 'approved';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;
