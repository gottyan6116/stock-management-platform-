import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type NisaType = "tsumitate" | "growth" | null;

export interface PurchaseWithName {
  id: string;
  instrumentId: string;
  name: string;
  nisaType: NisaType;
  side: "buy" | "sell";
  tradedOn: string;
  quantity: number | null;
  amountJpy: number;
}

/** 指定年の購入履歴（新しい順）。RLSと user_id 絞り込みの両方で本人の行だけを返す。 */
export async function listPurchasesForYear(
  supabase: SupabaseClient<Database>,
  userId: string,
  year: number
): Promise<PurchaseWithName[]> {
  const { data, error } = await supabase
    .from("position_purchases")
    .select("id, instrument_id, nisa_type, side, traded_on, quantity, amount_jpy, instruments(name)")
    .eq("user_id", userId)
    .gte("traded_on", `${year}-01-01`)
    .lte("traded_on", `${year}-12-31`)
    .order("traded_on", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    instrumentId: row.instrument_id,
    name: (row.instruments as { name: string } | null)?.name ?? "",
    nisaType: row.nisa_type,
    side: row.side,
    tradedOn: row.traded_on,
    quantity: row.quantity === null ? null : Number(row.quantity),
    amountJpy: Number(row.amount_jpy),
  }));
}

export async function insertPurchase(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    instrumentId: string;
    nisaType: NisaType;
    tradedOn: string;
    amountJpy: number;
    quantity?: number | null;
  }
) {
  const { data, error } = await supabase
    .from("position_purchases")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      nisa_type: params.nisaType,
      side: "buy",
      traded_on: params.tradedOn,
      amount_jpy: params.amountJpy,
      quantity: params.quantity ?? null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function deletePurchase(supabase: SupabaseClient<Database>, userId: string, purchaseId: string) {
  const { error } = await supabase.from("position_purchases").delete().eq("user_id", userId).eq("id", purchaseId);
  if (error) throw error;
}
