-- 按北京时间自然月记录新提交的图片数量，同一订单重试不重复占用额度。
create table public.billing_image_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  used integer not null check (used > 0),
  primary key (user_id, month_start)
);

alter table public.billing_image_usage enable row level security;
revoke all on public.billing_image_usage from public, anon, authenticated;
grant select, insert, update on public.billing_image_usage to service_role;

create function public.read_billing_usage(p_user uuid)
returns table (expires_at timestamptz, image_limit integer, used integer)
language sql
stable
set search_path = ''
as $$
  select expiry.expires_at,
    case when expiry.expires_at > pg_catalog.statement_timestamp() then 50 else 3 end,
    coalesce(usage.used, 0)
  from (
    select max(subscription_end) as expires_at
    from public.zpay_transactions
    where user_id = p_user and status = 'paid' and is_subscription
  ) as expiry
  left join public.billing_image_usage as usage
    on usage.user_id = p_user
    and usage.month_start = pg_catalog.date_trunc('month', pg_catalog.statement_timestamp() at time zone 'Asia/Shanghai')::date;
$$;

revoke all on function public.read_billing_usage(uuid) from public, anon, authenticated;
grant execute on function public.read_billing_usage(uuid) to service_role;

create function public.charge_studio_image_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner uuid;
  month_start date;
  allowed integer;
begin
  select owner_id into strict owner from public.studio_projects where id = new.project_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 19127));
  month_start := pg_catalog.date_trunc('month', pg_catalog.statement_timestamp() at time zone 'Asia/Shanghai')::date;
  select image_limit into strict allowed from public.read_billing_usage(owner);

  if new.image_count <= allowed then
    insert into public.billing_image_usage as usage (user_id, month_start, used)
    values (owner, month_start, new.image_count)
    on conflict on constraint billing_image_usage_pkey do update set used = usage.used + excluded.used
      where usage.used + excluded.used <= allowed;
    if found then return null; end if;
  end if;

  raise exception using errcode = 'PZ001', message = '本月剩余生图额度不足。';
end;
$$;

revoke all on function public.charge_studio_image_quota() from public, anon, authenticated;
grant execute on function public.charge_studio_image_quota() to service_role;
create trigger studio_submissions_image_quota
after insert on public.studio_submissions
for each row execute function public.charge_studio_image_quota();
