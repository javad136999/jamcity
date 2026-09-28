-- Tighten each city's map viewport to the urban area.
-- Keeps existing city IDs and user/content assignments unchanged.
-- Jam is kept close to its current behavior; larger cities get a wider
-- city-scale frame, while smaller cities open at a closer zoom.

with city_view(slug, zoom, min_zoom, south_lat, west_lng, north_lat, east_lng) as (
  values
    ('jam',         14, 12, 27.7794, 52.2742, 27.8594, 52.3742),
    ('assaluyeh',   15, 13, 27.4560, 52.5790, 27.4960, 52.6390),
    ('kangan',      15, 13, 27.8093, 52.0281, 27.8593, 52.0981),
    ('deyr',        15, 13, 27.8170, 51.9088, 27.8610, 51.9688),
    ('bushehr',     14, 12, 28.8734, 50.7553, 28.9734, 50.8853),
    ('borazjan',    15, 12, 29.2270, 51.1630, 29.3070, 51.2730),
    ('khormuj',     15, 13, 28.6280, 51.3410, 28.6780, 51.4110),
    ('ganaveh',     14, 12, 29.5440, 50.4670, 29.6140, 50.5670),
    ('deylam',      14, 12, 30.0880, 50.1290, 30.1480, 50.2090),
    ('ahram',       15, 13, 28.8610, 51.2450, 28.9050, 51.3050),
    ('kalameh',     15, 13, 28.2900, 51.4850, 28.3300, 51.5350),
    ('nakhl-taqi',  15, 13, 27.4820, 52.5650, 27.5180, 52.6150),
    ('chah-mobarak',15, 13, 27.1220, 52.2950, 27.1580, 52.3450),
    ('siraf',       15, 13, 27.6420, 52.3150, 27.6780, 52.3750)
)
update public.cities c
set zoom = v.zoom,
    min_zoom = v.min_zoom,
    max_zoom = 18,
    south_lat = v.south_lat,
    west_lng = v.west_lng,
    north_lat = v.north_lat,
    east_lng = v.east_lng
from city_view v
where c.slug = v.slug
  and c.is_active = true;
