-- ============================================================
-- جم‌سیتی — Google OAuth onboarding support
-- Adds profiles.onboarded so new (esp. Google) sign-ins are sent
-- through a "choose your username" step before using the app.
-- Updates handle_new_user() to also read Google's raw_user_meta_data
-- keys (full_name / name / avatar_url / picture).
-- Safe to run multiple times.
-- ============================================================

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Existing users (already had a real username set manually) are
-- considered already onboarded so they are not sent to the
-- onboarding screen again.
update public.profiles set onboarded = true where onboarded = false;

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

  insert into public.profiles (id, username, display_name, avatar_url, onboarded, created_at)
  values (
    new.id,
    final_username,
    display,
    avatar,
    false,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
