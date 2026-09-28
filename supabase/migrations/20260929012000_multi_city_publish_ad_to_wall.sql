-- Keep the ad-to-wall RPC aligned with the multi-city schema.
create or replace function public.publish_ad_to_wall(
  p_content text,
  p_image_url text,
  p_category text,
  p_ad_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_city_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_ad_id is not null then
    select city_id into v_city_id
    from public.ads
    where id = p_ad_id and user_id = auth.uid();

    if v_city_id is null then
      raise exception 'invalid ad';
    end if;
  else
    select city_id into v_city_id
    from public.profiles
    where id = auth.uid();
  end if;

  if v_city_id is null then
    raise exception 'city not configured';
  end if;

  insert into public.wall_messages (user_id, city_id, content, image_url, category, ad_id)
  values (auth.uid(), v_city_id, p_content, p_image_url, p_category, p_ad_id)
  returning id into v_id;

  return v_id;
end;
$function$;
