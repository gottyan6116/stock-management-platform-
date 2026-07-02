-- StockScope初期スキーマ（設計書22章準拠）
-- 冪等性: instrument(provider,provider_symbol)一意制約、daily_prices(instrument_id,trading_date)複合PK、
-- fx_rates(pair,rate_date)複合PKにより、同一データのupsertを何度実行しても行が重複増殖しない。

create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'yahoo',
  provider_symbol text not null,
  display_symbol text not null,
  name text not null,
  exchange text,
  market text not null check (market in ('JP', 'US')),
  currency text not null check (currency in ('JPY', 'USD')),
  instrument_type text not null check (
    instrument_type in ('stock', 'etf', 'index')
  ),
  sector text,
  industry text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_symbol)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, instrument_id)
);

create table if not exists public.daily_prices (
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  trading_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adjusted_close numeric,
  volume bigint,
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  primary key (instrument_id, trading_date)
);

create index if not exists daily_prices_instrument_date_desc_idx
  on public.daily_prices (instrument_id, trading_date desc);

create table if not exists public.quote_snapshots (
  instrument_id uuid primary key references public.instruments(id) on delete cascade,
  price_date date,
  fetched_at timestamptz not null default now(),
  close numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  dividend_yield numeric,
  market_cap numeric,
  trailing_pe numeric,
  forward_pe numeric,
  raw_currency text
);

create table if not exists public.fx_rates (
  pair text not null,
  rate_date date not null,
  close numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (pair, rate_date)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (
    trigger_type in ('cron', 'manual', 'initial_backfill')
  ),
  status text not null check (
    status in ('running', 'success', 'partial_success', 'failed')
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  requested_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  error_summary jsonb
);

create table if not exists public.sync_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- updated_at自動更新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists instruments_set_updated_at on public.instruments;
create trigger instruments_set_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();

-- RLS（設計書23.3準拠）: ユーザー依存テーブルのみ有効化。
-- instruments / daily_prices / quote_snapshots / fx_rates / sync_runs / sync_items は
-- 個人情報を含まない共有マスタ/運用データのため、読み取りはservice role経由(サーバー)のみで
-- クライアントから直接アクセスしない設計とし、RLSはfavoritesにのみ適用する。
alter table public.favorites enable row level security;

create policy "users can read own favorites"
on public.favorites
for select
using (auth.uid() = user_id);

create policy "users can insert own favorites"
on public.favorites
for insert
with check (auth.uid() = user_id);

create policy "users can delete own favorites"
on public.favorites
for delete
using (auth.uid() = user_id);
