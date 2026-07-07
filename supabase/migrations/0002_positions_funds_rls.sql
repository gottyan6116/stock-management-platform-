-- 0002: ポートフォリオ(保有資産)テーブル追加 / 投資信託対応 / 共有テーブルのRLS強化
-- オーナー指示によるスコープ変更（docs/adr/0002-owner-scope-changes.md 参照）

-- 1. instruments に投資信託(fund)を追加
alter table public.instruments drop constraint if exists instruments_instrument_type_check;
alter table public.instruments add constraint instruments_instrument_type_check
  check (instrument_type in ('stock', 'etf', 'index', 'fund'));

-- 2. 保有資産テーブル（手入力。証券口座連携はしない）
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  avg_cost numeric check (avg_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, instrument_id)
);

drop trigger if exists positions_set_updated_at on public.positions;
create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

alter table public.positions enable row level security;

create policy "users can read own positions"
on public.positions for select
using (auth.uid() = user_id);

create policy "users can insert own positions"
on public.positions for insert
with check (auth.uid() = user_id);

create policy "users can update own positions"
on public.positions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own positions"
on public.positions for delete
using (auth.uid() = user_id);

-- 3. 共有テーブルのRLS強化
-- RLS無効のテーブルはanon keyで直接読み書きできてしまうため、全テーブルでRLSを有効化する。
-- 読み取りはログイン済みユーザーのみ許可、書き込みポリシーは作らない（サーバーのservice roleのみが書ける）。
alter table public.instruments enable row level security;
drop policy if exists "authenticated can read instruments" on public.instruments;
create policy "authenticated can read instruments"
on public.instruments for select to authenticated using (true);

alter table public.daily_prices enable row level security;
drop policy if exists "authenticated can read daily prices" on public.daily_prices;
create policy "authenticated can read daily prices"
on public.daily_prices for select to authenticated using (true);

alter table public.quote_snapshots enable row level security;
drop policy if exists "authenticated can read quote snapshots" on public.quote_snapshots;
create policy "authenticated can read quote snapshots"
on public.quote_snapshots for select to authenticated using (true);

alter table public.fx_rates enable row level security;
drop policy if exists "authenticated can read fx rates" on public.fx_rates;
create policy "authenticated can read fx rates"
on public.fx_rates for select to authenticated using (true);

alter table public.sync_runs enable row level security;
drop policy if exists "authenticated can read sync runs" on public.sync_runs;
create policy "authenticated can read sync runs"
on public.sync_runs for select to authenticated using (true);

alter table public.sync_items enable row level security;
drop policy if exists "authenticated can read sync items" on public.sync_items;
create policy "authenticated can read sync items"
on public.sync_items for select to authenticated using (true);
