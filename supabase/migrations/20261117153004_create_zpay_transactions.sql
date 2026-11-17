-- 订单金额与订阅时长在下单时确定，浏览器无权读写账本。
create table if not exists public.zpay_transactions (
  id uuid primary key default gen_random_uuid(),
  out_trade_no text not null unique check (out_trade_no ~ '^[0-9]{1,32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  zpay_pid text not null,
  product_id text not null,
  product_name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'CNY',
  payment_type text not null check (payment_type in ('alipay', 'wxpay', 'qqpay', 'tenpay')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  is_subscription boolean not null default false,
  subscription_period text check (subscription_period in ('monthly', 'yearly')),
  trade_no text unique,
  checkout_url text,
  raw_request jsonb,
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  subscription_start timestamptz,
  subscription_end timestamptz,
  check (is_subscription = (subscription_period is not null))
);

create index if not exists zpay_transactions_user_orders on public.zpay_transactions (user_id, created_at desc);
create index if not exists zpay_transactions_user_expiry on public.zpay_transactions (user_id, subscription_end desc)
  where is_subscription and status = 'paid';

alter table public.zpay_transactions enable row level security;
revoke all on public.zpay_transactions from public, anon, authenticated;
grant select, insert, update on public.zpay_transactions to service_role;

create function public.settle_zpay_transaction(
  p_order text, p_merchant text, p_trade text, p_method text, p_amount_cents integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  item public.zpay_transactions%rowtype;
  settled_at timestamptz;
  latest_expiry timestamptz;
  starts_at timestamptz;
  ends_at timestamptz;
begin
  -- 同一订单只入账一次，并按账号串行化不同订阅订单的到期计算。
  select * into item from public.zpay_transactions where out_trade_no = p_order for update;

  if not found or item.zpay_pid is distinct from p_merchant
    or item.payment_type is distinct from p_method
    or (item.amount * 100) is distinct from p_amount_cents
    or item.currency is distinct from 'CNY' or p_amount_cents <= 0
    or p_trade is null or p_trade !~ '^[a-zA-Z0-9_-]{1,128}$' then
    return false;
  end if;

  if item.status = 'paid' then
    return item.trade_no = p_trade;
  end if;

  if item.status <> 'pending' then
    return false;
  end if;

  if item.is_subscription then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(item.user_id::text, 19127));
    select max(subscription_end) into latest_expiry from public.zpay_transactions
      where user_id = item.user_id and is_subscription and status = 'paid';
  end if;

  settled_at := pg_catalog.clock_timestamp();
  if item.is_subscription then
    starts_at := greatest(settled_at, latest_expiry);
    ends_at := ((starts_at at time zone 'Asia/Shanghai') + pg_catalog.make_interval(months => case item.subscription_period when 'yearly' then 12 else 1 end))
      at time zone 'Asia/Shanghai';
  end if;

  update public.zpay_transactions set
    status = 'paid',
    trade_no = p_trade,
    updated_at = settled_at,
    paid_at = settled_at,
    subscription_start = starts_at,
    subscription_end = ends_at
  where out_trade_no = p_order;
  return true;
exception
  when unique_violation then return false;
end;
$$;

revoke all on function public.settle_zpay_transaction(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.settle_zpay_transaction(text, text, text, text, integer) to service_role;
