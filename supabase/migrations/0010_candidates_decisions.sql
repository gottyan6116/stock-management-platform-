-- 0010: 候補・検証（個別株の購入判断）。
-- 既存データの削除・書き換えはしない。favorites に状態列を足し、新しいテーブルを追加する。
-- 適用前に positions と同様にバックアップを取ること（favorites のコピー: 手順書 §8）。

-- 1) 候補の状態。既存のお気に入りはすべて「未評価」から始める。
alter table public.favorites
  add column if not exists status text not null default 'unevaluated'
  check (status in ('unevaluated', 'considering', 'purchased', 'passed'));

-- favorites には更新ポリシーが無かったため、状態を変えられるように追加する。
create policy "users can update own favorites"
on public.favorites for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- すでに保有している銘柄の候補は「購入済」にする（状態列を足した直後の初期値のみ）。
update public.favorites f
set status = 'purchased'
where f.status = 'unevaluated'
  and exists (
    select 1 from public.positions p
    where p.user_id = f.user_id and p.instrument_id = f.instrument_id
  );

-- 2) ユーザー設定。オルカンの想定年率リターン（ハードル）と、比較に使うオルカン銘柄。
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  benchmark_expected_return numeric,
  benchmark_instrument_id uuid references public.instruments(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "users can read own settings"
on public.user_settings for select
using (auth.uid() = user_id);

create policy "users can insert own settings"
on public.user_settings for insert
with check (auth.uid() = user_id);

create policy "users can update own settings"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 3) 判断シート（下書き）。銘柄ごとに1つ。仮説と3シナリオの前提を保存する。
create table if not exists public.decision_sheets (
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  thesis_why text not null default '',
  thesis_wrong text not null default '',
  scenarios jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, instrument_id)
);

alter table public.decision_sheets enable row level security;

create policy "users can read own decision sheets"
on public.decision_sheets for select
using (auth.uid() = user_id);

create policy "users can insert own decision sheets"
on public.decision_sheets for insert
with check (auth.uid() = user_id);

create policy "users can update own decision sheets"
on public.decision_sheets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own decision sheets"
on public.decision_sheets for delete
using (auth.uid() = user_id);

-- 4) 判断の記録。「購入判断」「見送り」を押した時点の前提・価格・日付を、書き換えられない形で残す。
--    答え合わせ（1年後・3年後）の元データになるため、更新ポリシーは付けない（削除のみ可）。
create table if not exists public.decision_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  decision text not null check (decision in ('buy', 'pass')),
  decided_on date not null,
  price numeric not null,
  currency text not null check (currency in ('JPY', 'USD')),
  dividend_yield numeric,
  current_per numeric,
  thesis_why text not null default '',
  thesis_wrong text not null default '',
  scenarios jsonb not null default '{}'::jsonb,
  hurdle_return numeric,
  benchmark_instrument_id uuid references public.instruments(id) on delete set null,
  benchmark_nav numeric,
  benchmark_nav_date date,
  created_at timestamptz not null default now()
);

create index if not exists decision_records_user_date_idx
  on public.decision_records (user_id, decided_on desc);

alter table public.decision_records enable row level security;

create policy "users can read own decision records"
on public.decision_records for select
using (auth.uid() = user_id);

create policy "users can insert own decision records"
on public.decision_records for insert
with check (auth.uid() = user_id);

create policy "users can delete own decision records"
on public.decision_records for delete
using (auth.uid() = user_id);
