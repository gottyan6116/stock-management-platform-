-- 0008: ポートフォリオ履歴（日次スナップショット）とNISA枠の消化管理。
-- 既存データは変更しない（列追加・新規テーブル追加のみ）。適用前に
-- docs/portfolio-redesign/phase2b-migration-runbook.md のバックアップ手順を実施すること。

-- 1) 旧つみたてNISA（2023年までの制度）を別属性として区別する。
--    nisa_type は変更せず、フラグで持つ（生涯投資枠1,800万円の集計対象外にするため）。
alter table public.positions
  add column if not exists nisa_legacy boolean not null default false;

-- 2) 購入履歴。NISAの年間投資枠は「その年に買付した金額」で消化されるため、
--    保有数量・平均取得単価だけでは復元できない。買付ごとに1行持つ。
--    positions への外部キーは張らない（保有を削除しても消化実績は残す）。
create table if not exists public.position_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  nisa_type text check (nisa_type in ('tsumitate', 'growth')),
  side text not null default 'buy' check (side in ('buy', 'sell')),
  traded_on date not null,
  quantity numeric not null check (quantity > 0),
  -- 円建ての約定金額（手数料除く）。外貨建ての場合は約定時の円換算額を入れる。
  amount_jpy numeric not null check (amount_jpy >= 0),
  source text not null default 'manual' check (source in ('manual', 'csv')),
  created_at timestamptz not null default now()
);

create index if not exists position_purchases_user_year_idx
  on public.position_purchases (user_id, traded_on desc);

alter table public.position_purchases enable row level security;

create policy "users can read own purchases"
on public.position_purchases for select
using (auth.uid() = user_id);

create policy "users can insert own purchases"
on public.position_purchases for insert
with check (auth.uid() = user_id);

create policy "users can update own purchases"
on public.position_purchases for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own purchases"
on public.position_purchases for delete
using (auth.uid() = user_id);

-- 3) 日次スナップショット。Vercel cron（service role）が1日1回書き込む。
--    is_estimated=true の行は、実測ではなく後から推計で埋めた期間（チャートで区別表示）。
create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value_jpy numeric not null,
  total_cost_jpy numeric,
  usd_jpy numeric,
  -- 口座別・資産クラス別の評価額（円）など。例: {"account":{"tsumitate":123},"assetClass":{"fund":123}}
  breakdown jsonb not null default '{}'::jsonb,
  is_estimated boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

alter table public.portfolio_snapshots enable row level security;

-- 読み取りは本人のみ。書き込みは service role（cron）だけ。
create policy "users can read own snapshots"
on public.portfolio_snapshots for select
using (auth.uid() = user_id);
