-- 0005: 株式売買シミュレーション（ペーパートレード）機能
-- オーナー指示によるスコープ変更（docs/adr/0002の延長）。
-- 為替換算を避けるため、現金残高はJPY/USDを別々に保持する（通貨をまたぐ変換をしない）。

create table if not exists public.simulation_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash_balance_jpy numeric not null default 10000000,
  cash_balance_usd numeric not null default 100000,
  initial_balance_jpy numeric not null default 10000000,
  initial_balance_usd numeric not null default 100000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists simulation_accounts_set_updated_at on public.simulation_accounts;
create trigger simulation_accounts_set_updated_at
  before update on public.simulation_accounts
  for each row execute function public.set_updated_at();

create table if not exists public.simulation_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  avg_cost numeric not null check (avg_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, instrument_id)
);

drop trigger if exists simulation_holdings_set_updated_at on public.simulation_holdings;
create trigger simulation_holdings_set_updated_at
  before update on public.simulation_holdings
  for each row execute function public.set_updated_at();

create table if not exists public.simulation_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price >= 0),
  currency text not null check (currency in ('JPY', 'USD')),
  realized_pnl numeric,
  executed_at timestamptz not null default now()
);

alter table public.simulation_accounts enable row level security;
create policy "users manage own simulation account"
on public.simulation_accounts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.simulation_holdings enable row level security;
create policy "users manage own simulation holdings"
on public.simulation_holdings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.simulation_trades enable row level security;
create policy "users manage own simulation trades"
on public.simulation_trades for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
