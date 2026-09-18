-- جم‌سیتی — محدود کردن بازنشر خودکار به ۱۰۰ آگهی اخیر و حذف آگهی‌های دارای شماره تماس
-- فقط برای wall_messages؛ بدون تغییر در سایر بخش‌های برنامه.

create or replace function private.prepare_and_publish_wall_republishes()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_local_date date := (now() at time zone 'Asia/Tehran')::date;
  v_source record;
  v_new_id uuid;
begin
  if not exists (select 1 from private.wall_republish_queue q where q.run_date = v_local_date) then
    insert into private.wall_republish_queue (run_date, source_message_id, scheduled_for)
    with recent_100 as (
      select wm.id,
             wm.created_at,
             wm.content,
             row_number() over (order by wm.created_at desc) as recent_rank
      from public.wall_messages wm
      where coalesce(wm.is_promo, false) = false
        and coalesce(wm.is_auto_republish, false) = false
        and wm.business_id is null
        and (wm.content is not null or wm.image_url is not null)
        and wm.created_at < now() - interval '1 day'
    ),
    eligible as (
      select r.id as source_message_id
      from recent_100 r
      where r.recent_rank <= 100
        and not (
          translate(
            coalesce(r.content, ''),
            '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
            '01234567890123456789'
          ) ~ '(^|[^0-9])(?:0[0-9]{9,10}|9[0-9]{9}|98[0-9]{10}|0098[0-9]{10})([^0-9]|$)'
        )
        and not exists (
          select 1
          from private.wall_republish_queue oldq
          where oldq.source_message_id = r.id
            and oldq.status in ('scheduled','publishing','published')
            and oldq.created_at > now() - interval '30 days'
        )
    ),
    candidates as (
      select e.source_message_id,
             row_number() over (order by random()) as rn
      from eligible e
      limit 4
    ),
    random_slots as (
      select row_number() over (order by random()) as rn,
             (v_local_date::timestamp
               + make_interval(mins => (9 * 60 + floor(random() * (14 * 60 + 1)))::int)
             ) at time zone 'Asia/Tehran' as scheduled_for
      from generate_series(1, 100)
      group by 2
      limit 4
    )
    select v_local_date, c.source_message_id, s.scheduled_for
    from candidates c
    join random_slots s using (rn);
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
        user_id, content, image_url, is_promo, business_id, category,
        reply_to, audio_url, is_auto_republish, source_message_id
      )
      select
        wm.user_id, wm.content, wm.image_url, false, null, wm.category,
        null, wm.audio_url, true, wm.id
      from public.wall_messages wm
      where wm.id = v_source.source_message_id
        and coalesce(wm.is_auto_republish, false) = false;

      select id into v_new_id
      from public.wall_messages
      where source_message_id = v_source.source_message_id
        and is_auto_republish = true
        and created_at >= now() - interval '2 minutes'
      order by created_at desc
      limit 1;

      update private.wall_republish_queue
         set status = 'published', published_message_id = v_new_id, published_at = now()
       where id = v_source.id;
    exception when others then
      update private.wall_republish_queue
         set status = 'failed', error_message = sqlerrm
       where id = v_source.id;
    end;
  end loop;
end;
$$;

revoke all on function private.prepare_and_publish_wall_republishes() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('jamcity-wall-random-republish')
    where exists (select 1 from cron.job where jobname = 'jamcity-wall-random-republish');

    perform cron.schedule(
      'jamcity-wall-random-republish',
      '* * * * *',
      'select private.prepare_and_publish_wall_republishes();'
    );
  end if;
end $$;
