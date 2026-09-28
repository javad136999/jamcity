-- Multi-city foundation: Jam + Kangan.
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  center_lat double precision not null,
  center_lng double precision not null,
  zoom integer not null default 14,
  min_zoom integer not null default 10,
  max_zoom integer not null default 18,
  south_lat double precision not null,
  west_lng double precision not null,
  north_lat double precision not null,
  east_lng double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;
drop policy if exists "cities_select_active" on public.cities;
create policy "cities_select_active" on public.cities for select using (is_active = true);

insert into public.cities
  (name, slug, center_lat, center_lng, zoom, min_zoom, max_zoom, south_lat, west_lng, north_lat, east_lng)
values
  ('جم', 'jam', 27.8194, 52.3242, 14, 10, 18, 27.78, 52.27, 27.87, 52.38),
  ('کنگان', 'kangan', 27.83434271, 52.06305948, 14, 10, 18, 27.79, 52.01, 27.88, 52.11)
on conflict (slug) do update set
  name = excluded.name, center_lat = excluded.center_lat, center_lng = excluded.center_lng,
  zoom = excluded.zoom, min_zoom = excluded.min_zoom, max_zoom = excluded.max_zoom,
  south_lat = excluded.south_lat, west_lng = excluded.west_lng,
  north_lat = excluded.north_lat, east_lng = excluded.east_lng, is_active = true;

alter table public.profiles add column if not exists city_id uuid references public.cities(id);
alter table public.ads add column if not exists city_id uuid references public.cities(id);
alter table public.businesses add column if not exists city_id uuid references public.cities(id);
alter table public.wall_messages add column if not exists city_id uuid references public.cities(id);

create index if not exists profiles_city_id_idx on public.profiles(city_id);
create index if not exists ads_city_id_created_at_idx on public.ads(city_id, created_at desc);
create index if not exists businesses_city_id_status_idx on public.businesses(city_id, subscription_status);
create index if not exists wall_messages_city_id_created_at_idx on public.wall_messages(city_id, created_at desc);

update public.profiles set city_id = (select id from public.cities where slug = 'jam') where city_id is null;
update public.ads set city_id = (select id from public.cities where slug = 'jam') where city_id is null;
update public.businesses set city_id = (select id from public.cities where slug = 'jam') where city_id is null;
update public.wall_messages set city_id = (select id from public.cities where slug = 'jam') where city_id is null;

alter table public.profiles alter column city_id set not null;
alter table public.ads alter column city_id set not null;
alter table public.businesses alter column city_id set not null;
alter table public.wall_messages alter column city_id set not null;
