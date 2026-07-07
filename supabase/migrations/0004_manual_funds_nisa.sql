-- 0004: 日本の投資信託（Yahoo Financeにシンボルが存在しない銘柄）を手入力で
-- ポートフォリオ管理できるようにする。NISA区分（つみたて/成長投資枠）にも対応する。
-- オーナー指示によるスコープ変更（docs/adr/0002の延長）。

alter table public.positions
  add column if not exists nisa_type text check (nisa_type in ('tsumitate', 'growth')),
  add column if not exists is_manual boolean not null default false,
  add column if not exists manual_unit_price numeric,
  add column if not exists manual_price_date date;

-- 同一ファンドをNISAつみたて/成長投資枠それぞれで別ロットとして保有できるようにする。
alter table public.positions drop constraint if exists positions_user_id_instrument_id_key;
alter table public.positions
  add constraint positions_user_instrument_nisa_key unique (user_id, instrument_id, nisa_type);
