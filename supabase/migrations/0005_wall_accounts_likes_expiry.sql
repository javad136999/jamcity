-- ============================================================
-- جم‌سیتی — Wall quick-accounts, message likes, business
-- expiry/renewal/suspension, and scheduled cleanup jobs.
-- Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles: flag accounts created via the public-wall
--    username/password quick sign-up (these may NOT register
--    a business — only real email/Google accounts can).
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_wall_account boolean not null default false;

-- ------------------------------------------------------------
-- 2. businesses: expiry + suspended status for the 30-day
--    subscription cycle, and renewal support.
-- ------------------------------------------------------------
alter table public.businesses
  drop constraint if exists businesses_subscription_status_check;

alter table public.businesses
  add constraint businesses_subscription_status_check
  check (subscription_status in ('pending', 'approved', 'rejected', 'suspended'));

alter table public.businesses
  add column if not exists expires_at timestamptz;

create index if not exists businesses_expires_at_idx on public.businesses (expires_at);

-- ------------------------------------------------------------
-- 3. wall_message_likes
-- ------------------------------------------------------------
create table if not exists public.wall_message_likes (
  message_id uuid not null references public.wall_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.wall_message_likes enable row level security;

drop policy if exists "wall_message_likes_select_all" on public.wall_message_likes;
create policy "wall_message_likes_select_all"
  on public.wall_message_likes for select
  using (true);

drop policy if exists "wall_message_likes_insert_own" on public.wall_message_likes;
create policy "wall_message_likes_insert_own"
  on public.wall_message_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "wall_message_likes_delete_own" on public.wall_message_likes;
create policy "wall_message_likes_delete_own"
  on public.wall_message_likes for delete
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wall_message_likes'
  ) then
    alter publication supabase_realtime add table public.wall_message_likes;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. handle_new_user(): support wall quick-accounts.
--    account_source = 'wall' in raw_user_meta_data means this
--    user signed up straight from the دیوار شهر جم gate — skip
--    onboarding (they already typed a username) and mark
--    is_wall_account so they can't register a business.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
  display text;
  avatar text;
  is_wall boolean;
begin
  base_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );
  base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '', 'g'));
  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  display := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    base_username
  );

  avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );

  is_wall := coalesce(new.raw_user_meta_data ->> 'account_source', '') = 'wall';

  insert into public.profiles (id, username, display_name, avatar_url, onboarded, is_wall_account, created_at)
  values (
    new.id,
    final_username,
    display,
    avatar,
    case when is_wall then true else false end,
    is_wall,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 5. Scheduled cleanup jobs via pg_cron (if the extension is
--    available on this project — Supabase enables it under
--    Database → Extensions → pg_cron on most plans).
--    a) suspend businesses whose 30-day subscription expired
--    b) purge wall-post images older than 7 days (messages stay)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then

    perform cron.unschedule('jamcity-suspend-expired-businesses')
    where exists (
      select 1 from cron.job where jobname = 'jamcity-suspend-expired-businesses'
    );

    perform cron.schedule(
      'jamcity-suspend-expired-businesses',
      '0 1 * * *',
      $cron$
        update public.businesses
        set subscription_status = 'suspended'
        where subscription_status = 'approved'
          and expires_at is not null
          and expires_at < now();
      $cron$
    );

    perform cron.unschedule('jamcity-purge-wall-images')
    where exists (
      select 1 from cron.job where jobname = 'jamcity-purge-wall-images'
    );

    perform cron.schedule(
      'jamcity-purge-wall-images',
      '30 1 * * *',
      $cron$
        delete from storage.objects
        where bucket_id = 'wall-images'
          and created_at < now() - interval '7 days';

        update public.wall_messages
        set image_url = null
        where image_url is not null
          and created_at < now() - interval '7 days';
      $cron$
    );

  end if;
end $$;
