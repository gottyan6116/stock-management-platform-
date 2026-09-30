-- 0009: 購入履歴の口数を任意にする。
-- NISAの年間投資枠の消化は「買付金額」で決まる。積立の買付は金額しか分からないことが多く、
-- 口数を必須にすると、分からない値を入れさせる（＝捏造させる）ことになるため。

alter table public.position_purchases alter column quantity drop not null;
alter table public.position_purchases drop constraint if exists position_purchases_quantity_check;
alter table public.position_purchases
  add constraint position_purchases_quantity_check check (quantity is null or quantity > 0);
