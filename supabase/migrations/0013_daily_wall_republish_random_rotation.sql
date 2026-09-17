-- جم‌سیتی — بازنشر خودکار روزانه ۴ آگهی قدیمی دیوار شهر جم
-- فقط برای wall_messages؛ بدون تغییر در سایر بخش‌های برنامه.

create schema if not exists private;

alter table public.wall_messages
  add column if not exists is_auto_republish boolean not null default false,
  add column if not exists source_message_id uuid references public.wall_messages(id) on delete set null;

create index if not exists wall_messages_auto_republish_idx
  on public.wall_messages (is_auto_republish, created_at desc);

create table if not exists private.wall_republish_queue (
  id bigint generated always as identity primary key,
  run_date date not null,
  source_message_id uuid not null references public.wall_messages(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','publishing','published','failed')),
  published_message_id uuid references public.wall_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  error_message text,
  unique (run_date, source_message_id),
  unique (run_date, scheduled_for)
);

create index if not exists wall_republish_queue_due_idx
  on private.wall_republish_queue (status, scheduled_for);

alter table private.wall_republish_queue enable row level security;

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
  -- برنامه هر روز فقط یک صف چهار‌تایی می‌سازد.
  if not exists (select 1 from private.wall_republish_queue q where q.run_date = v_local_date) then
    insert into private.wall_republish_queue (run_date, source_message_id, scheduled_for)
    with candidates as (
      select wm.id as source_message_id,
             row_number() over (order by random()) as rn
      from public.wall_messages wm
      where coalesce(wm.is_promo, false) = false
        and coalesce(wm.is_auto_republish, false) = false
        and wm.business_id is null
        and (wm.content is not null or wm.image_url is not null)
        and wm.created_at < now() - interval '1 day'
        and not exists (
          select 1 from private.wall_republish_queue oldq
          where oldq.source_message_id = wm.id
            and oldq.status in ('scheduled','publishing','published')
            and oldq.created_at > now() - interval '30 days'
        )
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

  -- کرون هر دقیقه اجرا می‌شود و فقط آگهی‌هایی که زمانشان رسیده منتشر می‌شوند.
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
