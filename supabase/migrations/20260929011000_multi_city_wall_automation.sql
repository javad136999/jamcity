-- Keep scheduled public-wall automation city-aware.
create or replace function private.prepare_and_publish_wall_republishes()
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_local_date date := (now() at time zone 'Asia/Tehran')::date;
  v_source record;
  v_needed integer;
begin
  if not exists (
    select 1 from public.auto_ads_settings
    where id = true and coalesce(enabled, true) = true
  ) then
    return;
  end if;

  select greatest(0, 10 - count(*)::integer)
  into v_needed
  from private.wall_republish_queue q
  where q.run_date = v_local_date
    and q.status in ('scheduled','publishing','published');

  if v_needed > 0 then
    insert into private.wall_republish_queue (run_date, source_message_id, scheduled_for)
    with normalized_messages as (
      select
        wm.id,
        wm.user_id,
        wm.created_at,
        translate(
          coalesce(wm.content, ''),
          '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
          '01234567890123456789'
        ) as normalized_content
      from public.wall_messages wm
      where coalesce(wm.is_promo, false) = false
        and coalesce(wm.is_auto_republish, false) = false
        and wm.business_id is null
        and (wm.content is not null or wm.image_url is not null)
        and wm.created_at < now() - interval '1 day'
    ),
    recent_300 as (
      select
        nm.id,
        nm.user_id,
        row_number() over (order by nm.created_at desc) as recent_rank
      from normalized_messages nm
      where nm.normalized_content ~* '(^|[^0-9])((\\+98|0098|98)?9[0-9]{9}|0[1-9][0-9]{8,9})([^0-9]|$)'
    ),
    eligible as (
      select r.id as source_message_id, r.user_id
      from recent_300 r
      where r.recent_rank <= 300
        and not exists (
          select 1
          from private.wall_republish_queue oldq
          where oldq.source_message_id = r.id
            and oldq.status in ('scheduled','publishing','published')
            and oldq.created_at > now() - interval '30 days'
        )
        and not exists (
          select 1
          from private.wall_republish_queue today_q
          join public.wall_messages today_source
            on today_source.id = today_q.source_message_id
          where today_q.run_date = v_local_date
            and today_q.status in ('scheduled','publishing','published')
            and today_source.user_id = r.user_id
        )
        and not exists (
          select 1
          from public.wall_messages today_auto
          where today_auto.is_auto_republish = true
            and today_auto.created_at >= date_trunc('day', now())
            and today_auto.created_at < date_trunc('day', now()) + interval '1 day'
            and today_auto.user_id = r.user_id
        )
    ),
    one_per_user as (
      select distinct on (e.user_id)
        e.source_message_id,
        e.user_id
      from eligible e
      order by e.user_id, e.source_message_id
    ),
    candidates as (
      select opu.source_message_id,
             row_number() over (order by random()) as rn
      from one_per_user opu
      limit 10
    ),
    random_slots as (
      select
        row_number() over (order by random()) as rn,
        (
          v_local_date::timestamp
          + make_interval(mins => (8 * 60 + floor(random() * (12 * 60 + 1)))::int)
        ) at time zone 'Asia/Tehran' as scheduled_for
      from generate_series(1, 200)
      group by 2
      limit 10
    )
    select v_local_date, c.source_message_id, s.scheduled_for
    from candidates c
    join random_slots s using (rn)
    where c.rn <= v_needed;
  end if;

  for v_source in
    select q.id, q.source_message_id
    from private.wall_republish_queue q
    where q.run_date = v_local_date
      and q.status = 'scheduled'
      and q.scheduled_for <= now()
    order by q.scheduled_for
    for update skip locked
  loop
    update private.wall_republish_queue
    set status = 'publishing', error_message = null
    where id = v_source.id;

    begin
      insert into public.wall_messages (
        user_id, city_id, content, image_url, is_promo, business_id, category,
        reply_to, audio_url, is_auto_republish, source_message_id
      )
      select
        wm.user_id, wm.city_id, wm.content, wm.image_url, false, null, wm.category,
        null, wm.audio_url, true, wm.id
      from public.wall_messages wm
      where wm.id = v_source.source_message_id
        and coalesce(wm.is_auto_republish, false) = false
        and translate(
          coalesce(wm.content, ''),
          '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
          '01234567890123456789'
        ) ~* '(^|[^0-9])((\\+98|0098|98)?9[0-9]{9}|0[1-9][0-9]{8,9})([^0-9]|$)';

      if not found then
        raise exception 'Source ad no longer contains a valid contact number';
      end if;

      update private.wall_republish_queue
      set status = 'published',
          published_message_id = (
            select id
            from public.wall_messages
            where source_message_id = v_source.source_message_id
              and is_auto_republish = true
            order by created_at desc
            limit 1
          ),
          published_at = now()
      where id = v_source.id;
    exception when others then
      update private.wall_republish_queue
      set status = 'failed', error_message = sqlerrm
      where id = v_source.id;
    end;
  end loop;
end;
$function$;

create or replace function private.prepare_and_publish_gold_business_ads()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  tehran_now timestamp;
  today_date date;
  candidate_count int;
  b record;
  slot_minutes int;
  scheduled_ts timestamptz;
  first_slot int;
  idx int := 0;
  published_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('jamcity-gold-business-ads'));
  tehran_now := timezone('Asia/Tehran', now());
  today_date := tehran_now::date;

  if not exists (select 1 from private.gold_business_ad_queue where run_date=today_date) then
    select count(*) into candidate_count
    from public.businesses
    where lower(coalesce(subscription_tier,''))='gold'
      and lower(coalesce(subscription_status,'')) in ('active','approved')
      and (expires_at is null or expires_at >= now());

    if candidate_count > 0 then
      for b in
        select x.id,x.owner_id,x.name,x.category,x.description,x.phone,x.image_url
        from public.businesses x
        where lower(coalesce(x.subscription_tier,''))='gold'
          and lower(coalesce(x.subscription_status,'')) in ('active','approved')
          and (x.expires_at is null or x.expires_at >= now())
        order by (
          select coalesce(max(q.published_at),timestamptz '1970-01-01')
          from private.gold_business_ad_queue q
          where q.business_id=x.id and q.status='published'
        ) asc,x.created_at asc
        limit 2
      loop
        idx := idx + 1;
        slot_minutes := 480 + floor(random()*721)::int;
        if idx=2 then
          select extract(epoch from (scheduled_for at time zone 'Asia/Tehran')::time)/60
          into first_slot
          from private.gold_business_ad_queue
          where run_date=today_date
          order by id
          limit 1;
          while abs(slot_minutes-first_slot)<120 loop
            slot_minutes := 480 + floor(random()*721)::int;
          end loop;
        end if;
        scheduled_ts := (today_date + make_interval(mins=>slot_minutes)) at time zone 'Asia/Tehran';
        insert into private.gold_business_ad_queue(run_date,business_id,scheduled_for)
        values(today_date,b.id,scheduled_ts);
      end loop;
    end if;
  end if;

  for b in
    select q.id,q.business_id,x.owner_id,x.name,x.description,x.phone,x.image_url
    from private.gold_business_ad_queue q
    join public.businesses x on x.id=q.business_id
    where q.run_date=today_date and q.status='scheduled' and q.scheduled_for<=now()
    order by q.scheduled_for
    for update of q skip locked
  loop
    update private.gold_business_ad_queue set status='publishing' where id=b.id;
    begin
      insert into public.wall_messages(user_id,city_id,content,image_url,is_promo,business_id,created_at)
      values(
        b.owner_id,
        '👑 تبلیغ کسب‌وکار طلایی جم‌سیتی' || E'\n' ||
        '🏪 ' || b.name || E'\n' ||
        coalesce(nullif(b.description,''),'برای معرفی و مشاهده خدمات این کسب‌وکار به صفحه آن سر بزنید.') ||
        case when nullif(b.phone,'') is not null then E'\n📞 ' || b.phone else '' end,
        b.image_url,b.city_id,false,b.business_id,now()
      )
      returning id into published_id;
      update private.gold_business_ad_queue
      set status='published',published_message_id=published_id,published_at=now(),error_message=null
      where id=b.id;
    exception when others then
      update private.gold_business_ad_queue set status='failed',error_message=sqlerrm where id=b.id;
    end;
  end loop;
end;
$$;
