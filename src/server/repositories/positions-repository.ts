import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];
type NisaType = Database["public"]["Tables"]["positions"]["Row"]["nisa_type"];

export interface PositionWithInstrument {
  id: string;
  quantity: number;
  avgCost: number | null;
  nisaType: NisaType;
  isManual: boolean;
  manualUnitPrice: number | null;
  manualPriceDate: string | null;
  createdAt: string;
  instrument: InstrumentRow;
}

export async function listPositions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PositionWithInstrument[]> {
  const { data, error } = await supabase
    .from("positions")
    .select(
      "id, quantity, avg_cost, nisa_type, is_manual, manual_unit_price, manual_price_date, created_at, instrument_id, instruments(*)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      quantity: row.quantity,
      avgCost: row.avg_cost,
      nisaType: row.nisa_type,
      isManual: row.is_manual,
      manualUnitPrice: row.manual_unit_price,
      manualPriceDate: row.manual_price_date,
      createdAt: row.created_at,
      instrument: row.instruments,
    }));
}

export async function upsertPosition(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    instrumentId: string;
    quantity: number;
    avgCost: number | null;
    nisaType?: NisaType;
    isManual?: boolean;
    manualUnitPrice?: number | null;
  }
) {
  const { data, error } = await supabase
    .from("positions")
    .upsert(
      {
        user_id: params.userId,
        instrument_id: params.instrumentId,
        quantity: params.quantity,
        avg_cost: params.avgCost,
        nisa_type: params.nisaType ?? null,
        is_manual: params.isManual ?? false,
        manual_unit_price: params.manualUnitPrice ?? null,
        manual_price_date: params.manualUnitPrice != null ? new Date().toISOString().slice(0, 10) : null,
      },
      { onConflict: "user_id,instrument_id,nisa_type" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removePosition(supabase: SupabaseClient<Database>, userId: string, positionId: string) {
  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("user_id", userId)
    .eq("id", positionId);

  if (error) throw error;
}
