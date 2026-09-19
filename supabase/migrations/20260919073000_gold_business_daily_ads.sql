create table if not exists private.gold_business_ad_queue (
  id bigint generated always as identity primary key,
  run_date date not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','publishing','published','failed')),
  published_message_id uuid references public.wall_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  error_message text
);

create index if not exists gold_business_ad_queue_run_date_idx
  on private.gold_business_ad_queue(run_date, status, scheduled_for);

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
      insert into public.wall_messages(user_id,content,image_url,is_promo,business_id,created_at)
      values(
        b.owner_id,
        '👑 تبلیغ کسب‌وکار طلایی جم‌سیتی' || E'\n' ||
        '🏪 ' || b.name || E'\n' ||
        coalesce(nullif(b.description,''),'برای معرفی و مشاهده خدمات این کسب‌وکار به صفحه آن سر بزنید.') ||
        case when nullif(b.phone,'') is not null then E'\n📞 ' || b.phone else '' end,
        b.image_url,false,b.business_id,now()
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

revoke all on function private.prepare_and_publish_gold_business_ads() from public;
grant execute on function private.prepare_and_publish_gold_business_ads() to postgres;

select cron.unschedule(jobid) from cron.job where jobname='jamcity-gold-business-ads';
select cron.schedule('jamcity-gold-business-ads','* * * * *','select private.prepare_and_publish_gold_business_ads();');