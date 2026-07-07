import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

export interface PositionWithInstrument {
  id: string;
  quantity: number;
  avgCost: number | null;
  createdAt: string;
  instrument: InstrumentRow;
}

export async function listPositions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PositionWithInstrument[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("id, quantity, avg_cost, created_at, instrument_id, instruments(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      quantity: row.quantity,
      avgCost: row.avg_cost,
      createdAt: row.created_at,
      instrument: row.instruments,
    }));
}

export async function upsertPosition(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string,
  quantity: number,
  avgCost: number | null
) {
  const { data, error } = await supabase
    .from("positions")
    .upsert(
      { user_id: userId, instrument_id: instrumentId, quantity, avg_cost: avgCost },
      { onConflict: "user_id,instrument_id" }
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
