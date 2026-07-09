-- 0006: 手入力ファンド（投資信託）の基準価額履歴テーブル
-- 保有ロット(positions)にではなくinstrument単位で価格履歴を持つことで、
-- 同じファンドを複数ロット（積立NISA/成長投資枠等）で保有していても価格は1本の履歴にまとまる。
-- 詳細ページ(/stocks/[symbol])でチャート表示するために使う。

create table if not exists public.manual_fund_prices (
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  price_date date not null,
  unit_price numeric not null check (unit_price >= 0),
  fetched_at timestamptz not null default now(),
  primary key (instrument_id, price_date)
);

create index if not exists manual_fund_prices_instrument_date_desc_idx
  on public.manual_fund_prices (instrument_id, price_date desc);

-- instruments等の共有参照テーブルと同じ方針: 読み取りはログイン済みユーザーへ許可、
-- 書き込みはservice role（サーバー）のみ。
alter table public.manual_fund_prices enable row level security;
create policy "authenticated can read manual fund prices"
on public.manual_fund_prices for select
using (auth.uid() is not null);
