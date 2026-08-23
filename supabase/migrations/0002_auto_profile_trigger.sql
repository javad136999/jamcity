-- ============================================================
-- جم‌سیتی — Auto-create profile row when a new auth user signs up
-- Fixes: "خطا در ساخت پروفایل" caused by email-confirmation being
-- enabled (no active session yet when the client tried to insert
-- into public.profiles directly, so RLS blocked it).
-- Safe to run multiple times.
-- ============================================================

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

  -- avoid unique_violation if the username is somehow already taken
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, created_at)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', base_username),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Allow the trigger (SECURITY DEFINER) to still work even though
-- profiles_insert_own only allows auth.uid() = id for normal client
-- inserts — SECURITY DEFINER functions bypass RLS, so no policy
-- change is needed here. This comment is just for clarity.
