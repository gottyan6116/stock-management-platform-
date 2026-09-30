# Phase 2B マイグレーション手順（0008）

対象: `supabase/migrations/0008_portfolio_history_nisa.sql`
内容: `positions.nisa_legacy` 列の追加、`position_purchases` と `portfolio_snapshots` の新規作成。
**既存の行・列は変更も削除もしません**（追加のみ）。それでも保有データは最優先資産なので、先にバックアップを取ります。

## 1. バックアップ（適用前に必ず実施）

Supabase ダッシュボード → SQL Editor で実行します。

```sql
-- 保有データの複製（同一DB内。リストアはここから INSERT すれば戻せる）
create table public.positions_backup_20260930 as select * from public.positions;
create table public.manual_fund_prices_backup_20260930 as select * from public.manual_fund_prices;

-- 件数が一致することを確認
select
  (select count(*) from public.positions)                     as positions_now,
  (select count(*) from public.positions_backup_20260930)      as positions_backup;
-- 期待値: どちらも 15
```

加えて、SQL Editor で `select * from public.positions;` を実行し、結果を **CSV でダウンロード**して手元に保管してください（DB外のバックアップ）。

## 2. 適用

`0008_portfolio_history_nisa.sql` の全文を SQL Editor に貼り付けて実行します。
`if not exists` を使っているので、途中で失敗しても再実行できます。

## 3. 適用後の確認

```sql
select count(*) from public.positions;                                    -- 15 のまま
select column_name from information_schema.columns
 where table_name = 'positions' and column_name = 'nisa_legacy';           -- 1行
select to_regclass('public.position_purchases'), to_regclass('public.portfolio_snapshots'); -- 両方 NULL でない
```

## 4. ロールバック（必要な場合のみ）

```sql
drop table if exists public.portfolio_snapshots;
drop table if exists public.position_purchases;
alter table public.positions drop column if exists nisa_legacy;
```

`positions` 本体は変更していないため、データの復元は不要です。バックアップテーブルは動作確認後に削除して構いません。

```sql
drop table public.positions_backup_20260930;
drop table public.manual_fund_prices_backup_20260930;
```

## 5. 適用後にこちらで行うこと

- 日次スナップショット cron（Vercel Cron → `/api/cron/snapshot`、`CRON_SECRET` で保護）
- ホームの資産推移チャート（推計期間は破線・注記で区別）
- NISA 枠カード（年間つみたて/成長、生涯は簿価ベース、旧つみたてNISAは別属性）

## 6. 追加マイグレーション 0009（購入履歴の口数を任意にする）

`supabase/migrations/0009_purchases_quantity_optional.sql`。積立の買付は金額しか分からないことが多いため、口数を必須にしません。
既存データには影響しない小さな変更です（制約の付け替えのみ）。**NISAの買付記録を使う前に SQL Editor で実行してください。**

## 7. 日次スナップショット用の環境変数

Vercel の Project → Settings → Environment Variables に `CRON_SECRET`（任意の長いランダム文字列）を追加します。
Vercel Cron は毎日 07:00 UTC（日本時間 16:00）に `/api/cron/snapshot` を呼び、`Authorization: Bearer <CRON_SECRET>` を付けます。
未設定の場合、cron は 401 で拒否されます（ホームを開いたときの記録は cron と無関係に動きます）。

## 8. マイグレーション 0010（候補・検証）

`supabase/migrations/0010_candidates_decisions.sql`。お気に入りに「状態」列を足し、設定・判断シート・判断記録の3テーブルを追加します。
**既存のお気に入りは削除せず**、状態を「未評価」で始めます（すでに保有している銘柄だけ「購入済」）。

適用前のバックアップ（SQL Editor）:

```sql
create table public.favorites_backup_20261001 as select * from public.favorites;
select (select count(*) from public.favorites) as now, (select count(*) from public.favorites_backup_20261001) as backup;
```

適用後の確認:

```sql
select status, count(*) from public.favorites group by status;
select to_regclass('public.user_settings'), to_regclass('public.decision_sheets'), to_regclass('public.decision_records');
```

ロールバック（追加分のみ削除。favorites の既存行は残る）:

```sql
drop table if exists public.decision_records;
drop table if exists public.decision_sheets;
drop table if exists public.user_settings;
drop policy if exists "users can update own favorites" on public.favorites;
alter table public.favorites drop column if exists status;
```
