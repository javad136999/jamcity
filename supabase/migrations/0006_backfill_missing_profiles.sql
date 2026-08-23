-- ============================================================
-- جم‌سیتی — Backfill missing profiles
-- Any auth.users row created BEFORE migration 0002 added the
-- handle_new_user() trigger has no matching public.profiles row.
-- That breaks anything with a foreign key to profiles (e.g.
-- businesses.owner_id) with:
--   "insert or update on table businesses violates foreign key
--    constraint businesses_owner_id_fkey"
-- This creates a profile for every such user, using the same
-- logic as the trigger. Safe to run multiple times.
-- ============================================================

do $$
declare
  u record;
  base_username text;
  final_username text;
  suffix int;
  display text;
  avatar text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    base_username := coalesce(
      u.raw_user_meta_data ->> 'username',
      split_part(u.email, '@', 1)
    );
    base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '', 'g'));
    if base_username is null or base_username = '' then
      base_username := 'user';
    end if;

    final_username := base_username;
    suffix := 0;
    while exists (select 1 from public.profiles where username = final_username) loop
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    end loop;

    display := coalesce(
      u.raw_user_meta_data ->> 'display_name',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      base_username
    );

    avatar := coalesce(
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture'
    );

    insert into public.profiles (id, username, display_name, avatar_url, onboarded, is_wall_account, created_at)
    values (u.id, final_username, display, avatar, true, false, now())
    on conflict (id) do nothing;
  end loop;
end $$;
