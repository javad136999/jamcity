-- ============================================================
-- Jam City - Phone Auth Profile Trigger
-- Creates a profile automatically for phone-based users
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
  display text;
begin

  -- Use phone number as username
  base_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    new.phone
  );

  -- Keep only numbers
  base_username := regexp_replace(base_username, '[^0-9]', '', 'g');

  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  final_username := base_username;

  -- Prevent duplicate usernames
  while exists (
    select 1
    from public.profiles
    where username = final_username
  ) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  display := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.phone,
    final_username
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    created_at
  )
  values (
    new.id,
    final_username,
    display,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;