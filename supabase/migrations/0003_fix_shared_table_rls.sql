-- 0003: 共有テーブルのRLS読み取りポリシーを auth.uid() ベースに修正
--
-- 0002で "to authenticated using (true)" という書き方でポリシーを作成したが、
-- このプロジェクトが使う新方式のAPIキー(sb_publishable_/sb_secret_)ではPostgRESTが
-- セッションのPostgresロールを文字通り"authenticated"にSET ROLEしないらしく、
-- "to authenticated"指定のポリシーが実質的に機能せず、全件0行が返っていた
-- （favoritesテーブルのauth.uid()ベースのポリシーは問題なく機能していたことで判明）。
-- ロール指定に依存せず、auth.uid()関数で判定する形に統一する。

drop policy if exists "authenticated can read instruments" on public.instruments;
create policy "authenticated can read instruments"
on public.instruments for select
using (auth.uid() is not null);

drop policy if exists "authenticated can read daily prices" on public.daily_prices;
create policy "authenticated can read daily prices"
on public.daily_prices for select
using (auth.uid() is not null);

drop policy if exists "authenticated can read quote snapshots" on public.quote_snapshots;
create policy "authenticated can read quote snapshots"
on public.quote_snapshots for select
using (auth.uid() is not null);

drop policy if exists "authenticated can read fx rates" on public.fx_rates;
create policy "authenticated can read fx rates"
on public.fx_rates for select
using (auth.uid() is not null);

drop policy if exists "authenticated can read sync runs" on public.sync_runs;
create policy "authenticated can read sync runs"
on public.sync_runs for select
using (auth.uid() is not null);

drop policy if exists "authenticated can read sync items" on public.sync_items;
create policy "authenticated can read sync items"
on public.sync_items for select
using (auth.uid() is not null);
