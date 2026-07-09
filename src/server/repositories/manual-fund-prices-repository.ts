import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type ManualFundPriceRow = Database["public"]["Tables"]["manual_fund_prices"]["Row"];

export async function listManualFundPrices(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ManualFundPriceRow[]> {
  const { data, error } = await supabase
    .from("manual_fund_prices")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("price_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** その日の基準価額を記録する（1instrument+1日=1件、冪等upsert）。書き込みはservice role専用。 */
export async function upsertManualFundPrice(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
  unitPrice: number,
  priceDate: string
): Promise<void> {
  const { error } = await supabase
    .from("manual_fund_prices")
    .upsert(
      { instrument_id: instrumentId, price_date: priceDate, unit_price: unitPrice },
      { onConflict: "instrument_id,price_date" }
    );
  if (error) throw error;
}

/** 証券会社の画面で見える過去の基準価額をまとめて取り込む（CSV/貼り付け一括登録用）。書き込みはservice role専用。 */
export async function bulkUpsertManualFundPrices(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
  rows: { priceDate: string; unitPrice: number }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("manual_fund_prices").upsert(
    rows.map((row) => ({
      instrument_id: instrumentId,
      price_date: row.priceDate,
      unit_price: row.unitPrice,
    })),
    { onConflict: "instrument_id,price_date" }
  );
  if (error) throw error;
}
