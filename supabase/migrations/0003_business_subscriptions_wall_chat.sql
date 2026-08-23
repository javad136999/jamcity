-- ============================================================
-- جم‌سیتی — Business subscriptions, product menus, public wall
-- (group chat), and private chat media (voice/image).
-- Admin access is restricted in the app to a single email
-- (exina30@gmail.com) checked via auth.jwt() ->> 'email'.
-- Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. businesses: subscription + approval workflow + icon
-- ------------------------------------------------------------
alter table public.businesses
  add column if not exists icon text not null default '🏬',
  add column if not exists subscription_tier text
    check (subscription_tier in ('bronze', 'silver', 'gold')),
  add column if not exists subscription_status text not null default 'pending'
    check (subscription_status in ('pending', 'approved', 'rejected')),
  add column if not exists receipt_url text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz;

create index if not exists businesses_subscription_status_idx
  on public.businesses (subscription_status);
create index if not exists businesses_subscription_tier_idx
  on public.businesses (subscription_tier);

-- Owners may only see their own pending/rejected businesses; everyone
-- can see approved ones.
drop policy if exists "businesses_select_all" on public.businesses;
create policy "businesses_select_approved_or_own_or_admin"
  on public.businesses for select
  using (
    subscription_status = 'approved'
    or auth.uid() = owner_id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  );

-- Admin (by email) can update/review any business (approve/reject).
drop policy if exists "businesses_update_owner" on public.businesses;
create policy "businesses_update_owner_or_admin"
  on public.businesses for update
  using (
    auth.uid() = owner_id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  )
  with check (
    auth.uid() = owner_id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  );

drop policy if exists "businesses_delete_owner" on public.businesses;
create policy "businesses_delete_owner_or_admin"
  on public.businesses for delete
  using (
    auth.uid() = owner_id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  );

-- ------------------------------------------------------------
-- 2. business_products (menu items)
-- ------------------------------------------------------------
create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  price numeric,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists business_products_business_idx
  on public.business_products (business_id);

alter table public.business_products enable row level security;

drop policy if exists "business_products_select_all" on public.business_products;
create policy "business_products_select_all"
  on public.business_products for select
  using (true);

drop policy if exists "business_products_write_owner" on public.business_products;
create policy "business_products_insert_owner"
  on public.business_products for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_products.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "business_products_update_owner" on public.business_products;
create policy "business_products_update_owner"
  on public.business_products for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_products.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "business_products_delete_owner" on public.business_products;
create policy "business_products_delete_owner"
  on public.business_products for delete
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_products.business_id and b.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. wall_messages (public group chat — "دیوار شهر جم")
-- ------------------------------------------------------------
create table if not exists public.wall_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text,
  image_url text,
  is_promo boolean not null default false,
  business_id uuid references public.businesses (id) on delete set null,
  created_at timestamptz not null default now(),
  check (content is not null or image_url is not null)
);

create index if not exists wall_messages_created_at_idx
  on public.wall_messages (created_at desc);

alter table public.wall_messages enable row level security;

drop policy if exists "wall_messages_select_all" on public.wall_messages;
create policy "wall_messages_select_all"
  on public.wall_messages for select
  using (true);

drop policy if exists "wall_messages_insert_own" on public.wall_messages;
create policy "wall_messages_insert_own"
  on public.wall_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "wall_messages_delete_own_or_admin" on public.wall_messages;
create policy "wall_messages_delete_own_or_admin"
  on public.wall_messages for delete
  using (
    auth.uid() = user_id
    or (auth.jwt() ->> 'email') = 'exina30@gmail.com'
  );

-- ------------------------------------------------------------
-- 4. private_messages: add voice/image support
-- ------------------------------------------------------------
alter table public.private_messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text', 'image', 'voice')),
  add column if not exists media_url text;

alter table public.private_messages alter column content drop not null;

-- ------------------------------------------------------------
-- 5. Realtime publication additions (idempotent)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wall_messages'
  ) then
    alter publication supabase_realtime add table public.wall_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'businesses'
  ) then
    alter publication supabase_realtime add table public.businesses;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. Storage buckets: receipts (private-ish, admin+owner read),
--    wall-images, voice-messages, product-images
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('wall-images', 'wall-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "storage_public_read_v2" on storage.objects;
create policy "storage_public_read_v2"
  on storage.objects for select
  using (
    bucket_id in (
      'ad-images', 'avatars', 'business-images',
      'receipts', 'wall-images', 'voice-messages', 'product-images'
    )
  );

drop policy if exists "storage_auth_upload_own_folder_v2" on storage.objects;
create policy "storage_auth_upload_own_folder_v2"
  on storage.objects for insert
  with check (
    bucket_id in (
      'ad-images', 'avatars', 'business-images',
      'receipts', 'wall-images', 'voice-messages', 'product-images'
    )
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage_auth_update_own_folder_v2" on storage.objects;
create policy "storage_auth_update_own_folder_v2"
  on storage.objects for update
  using (
    bucket_id in (
      'ad-images', 'avatars', 'business-images',
      'receipts', 'wall-images', 'voice-messages', 'product-images'
    )
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage_auth_delete_own_folder_v2" on storage.objects;
create policy "storage_auth_delete_own_folder_v2"
  on storage.objects for delete
  using (
    bucket_id in (
      'ad-images', 'avatars', 'business-images',
      'receipts', 'wall-images', 'voice-messages', 'product-images'
    )
    and auth.uid()::text = (storage.foldername(name))[1]
  );
