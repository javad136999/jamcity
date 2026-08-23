-- ============================================================
-- جم‌سیتی (JamCity) — Initial schema, RLS policies & realtime
-- Safe to run once on a fresh Supabase project.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. categories (reference table, optional use alongside lib/constants.ts)
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon text
);

alter table public.categories enable row level security;

drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories for select
  using (true);

insert into public.categories (name, slug, icon) values
  ('املاک', 'real-estate', '🏠'),
  ('خودرو', 'car', '🚗'),
  ('موبایل', 'mobile', '📱'),
  ('لوازم خانه', 'home-appliances', '🛋️'),
  ('استخدام', 'jobs', '💼'),
  ('خدمات', 'services', '🛠️'),
  ('خرید و فروش', 'market', '🛒'),
  ('لوازم شخصی', 'personal', '🎒'),
  ('سایر', 'other', '✨')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 3. ads
-- ------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  price numeric,
  category text not null,
  region text not null,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'reserved', 'sold', 'expired')),
  images text[] not null default '{}',
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists ads_created_at_idx on public.ads (created_at desc);
create index if not exists ads_category_idx on public.ads (category);
create index if not exists ads_user_id_idx on public.ads (user_id);
create index if not exists ads_status_idx on public.ads (status);

alter table public.ads enable row level security;

drop policy if exists "ads_select_all" on public.ads;
create policy "ads_select_all"
  on public.ads for select
  using (true);

drop policy if exists "ads_insert_own" on public.ads;
create policy "ads_insert_own"
  on public.ads for insert
  with check (auth.uid() = user_id);

drop policy if exists "ads_update_own" on public.ads;
create policy "ads_update_own"
  on public.ads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ads_delete_own" on public.ads;
create policy "ads_delete_own"
  on public.ads for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. favorites
-- ------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, ad_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. businesses
-- ------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  category text not null,
  address text not null,
  phone text,
  description text,
  hours text,
  image_url text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists businesses_category_idx on public.businesses (category);

alter table public.businesses enable row level security;

drop policy if exists "businesses_select_all" on public.businesses;
create policy "businesses_select_all"
  on public.businesses for select
  using (true);

drop policy if exists "businesses_insert_owner" on public.businesses;
create policy "businesses_insert_owner"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "businesses_update_owner" on public.businesses;
create policy "businesses_update_owner"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "businesses_delete_owner" on public.businesses;
create policy "businesses_delete_owner"
  on public.businesses for delete
  using (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- 6. conversations
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles (id) on delete cascade,
  user_two uuid not null references public.profiles (id) on delete cascade,
  ad_id uuid references public.ads (id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_one <> user_two)
);

create index if not exists conversations_user_one_idx on public.conversations (user_one);
create index if not exists conversations_user_two_idx on public.conversations (user_two);

alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  using (auth.uid() = user_one or auth.uid() = user_two);

drop policy if exists "conversations_insert_participant" on public.conversations;
create policy "conversations_insert_participant"
  on public.conversations for insert
  with check (auth.uid() = user_one or auth.uid() = user_two);

-- ------------------------------------------------------------
-- 7. private_messages
-- ------------------------------------------------------------
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists private_messages_conversation_idx
  on public.private_messages (conversation_id, created_at);

alter table public.private_messages enable row level security;

drop policy if exists "messages_select_participant" on public.private_messages;
create policy "messages_select_participant"
  on public.private_messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = private_messages.conversation_id
        and (c.user_one = auth.uid() or c.user_two = auth.uid())
    )
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
  );

-- Only the recipient (not the sender) marks messages as read.
drop policy if exists "messages_update_mark_read" on public.private_messages;
create policy "messages_update_mark_read"
  on public.private_messages for update
  using (
    auth.uid() <> sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = private_messages.conversation_id
        and (c.user_one = auth.uid() or c.user_two = auth.uid())
    )
  )
  with check (auth.uid() <> sender_id);

-- ------------------------------------------------------------
-- 8. notifications
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9. Realtime publication (idempotent — never re-adds an already-added table)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'private_messages'
  ) then
    alter publication supabase_realtime add table public.private_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ------------------------------------------------------------
-- 10. Storage buckets (public read, authenticated write to own folder)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('business-images', 'business-images', true)
on conflict (id) do nothing;

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
  on storage.objects for select
  using (bucket_id in ('ad-images', 'avatars', 'business-images'));

drop policy if exists "storage_auth_upload_own_folder" on storage.objects;
create policy "storage_auth_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id in ('ad-images', 'avatars', 'business-images')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage_auth_update_own_folder" on storage.objects;
create policy "storage_auth_update_own_folder"
  on storage.objects for update
  using (
    bucket_id in ('ad-images', 'avatars', 'business-images')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage_auth_delete_own_folder" on storage.objects;
create policy "storage_auth_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id in ('ad-images', 'avatars', 'business-images')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
