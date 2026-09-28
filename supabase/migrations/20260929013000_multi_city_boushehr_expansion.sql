-- Additive expansion of the existing Jam/Kangan multi-city schema.
-- Existing city IDs and city assignments are intentionally preserved.

alter table public.cities
  add column if not exists province text not null default 'بوشهر';

-- One canonical row per physical city. «دیر» و «دیّر» نگارش‌های یک شهرند؛
-- مسیرهای جایگزین در lib/cities.ts به slug=deyr نگاشت می‌شوند.
with city_seed(name, slug, lat, lng) as (
  values
    ('جم',          'jam',          27.8194::double precision, 52.3242::double precision),
    ('عسلویه',      'assaluyeh',    27.4760, 52.6090),
    ('کنگان',       'kangan',       27.8343, 52.0631),
    ('دیر',         'deyr',         27.8390, 51.9388),
    ('بوشهر',       'bushehr',      28.9234, 50.8203),
    ('برازجان',     'borazjan',     29.2670, 51.2180),
    ('خورموج',      'khormuj',      28.6530, 51.3760),
    ('گناوه',       'ganaveh',      29.5790, 50.5170),
    ('دیلم',        'deylam',       30.1180, 50.1690),
    ('اهرم',        'ahram',        28.8830, 51.2750),
    ('کلمه',        'kalameh',      28.3100, 51.5100),
    ('نخل تقی',     'nakhl-taqi',   27.5000, 52.5900),
    ('چاه مبارک',   'chah-mobarak', 27.1400, 52.3200),
    ('سیراف',       'siraf',        27.6600, 52.3450)
), city_rows as (
  select
    name,
    slug,
    lat as center_lat,
    lng as center_lng,
    case when slug in ('bushehr', 'borazjan', 'ganaveh', 'deylam') then 13 else 14 end as zoom,
    case when slug in ('bushehr', 'borazjan', 'ganaveh', 'deylam') then 0.10 else 0.055 end as lat_span,
    case when slug in ('bushehr', 'borazjan', 'ganaveh', 'deylam') then 0.12 else 0.075 end as lng_span
  from city_seed
)
insert into public.cities (
  name, slug, province, center_lat, center_lng, zoom, min_zoom, max_zoom,
  south_lat, west_lng, north_lat, east_lng, is_active
)
select
  name, slug, 'بوشهر', center_lat, center_lng, zoom, 10, 18,
  center_lat - lat_span, center_lng - lng_span,
  center_lat + lat_span, center_lng + lng_span, true
from city_rows
on conflict (slug) do update
set province = excluded.province,
    is_active = true;

-- Events are city-scoped. Existing events remain assigned to Jam, matching
-- the legacy product behavior; no event content is removed or rewritten.
alter table public.events
  add column if not exists city_id uuid references public.cities(id);
update public.events
set city_id = (select id from public.cities where slug = 'jam')
where city_id is null;
alter table public.events alter column city_id set not null;
create index if not exists events_city_id_published_date_idx
  on public.events(city_id, is_published, event_date);

-- Local Jam news is city-bound; other sections remain shared/global (NULL).
alter table public.jamcity_content
  add column if not exists city_id uuid references public.cities(id);
update public.jamcity_content
set city_id = (select id from public.cities where slug = 'jam')
where city_id is null and section = 'jam';
create index if not exists jamcity_content_city_section_published_idx
  on public.jamcity_content(city_id, section, published_at desc);

-- Allow admins to manage cities while active cities remain publicly readable.
drop policy if exists cities_admin_select on public.cities;
create policy cities_admin_select
  on public.cities for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists cities_admin_insert on public.cities;
create policy cities_admin_insert
  on public.cities for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists cities_admin_update on public.cities;
create policy cities_admin_update
  on public.cities for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ));

grant select on public.cities to anon, authenticated;
grant insert, update on public.cities to authenticated;

-- Narrow RPC avoids granting broad profile-update rights to administrators.
create or replace function public.admin_set_user_city(p_user_id uuid, p_city_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'admin access required';
  end if;

  if not exists (
    select 1 from public.cities
    where id = p_city_id and is_active = true
  ) then
    raise exception 'active city required';
  end if;

  update public.profiles set city_id = p_city_id where id = p_user_id;
  if not found then
    raise exception 'user profile not found';
  end if;
end;
$function$;

revoke all on function public.admin_set_user_city(uuid, uuid) from public;
grant execute on function public.admin_set_user_city(uuid, uuid) to authenticated;
