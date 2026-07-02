import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

export interface FavoriteWithInstrument {
  id: string;
  createdAt: string;
  instrument: InstrumentRow;
}

/**
 * RLSにより、渡されたsupabaseクライアントのセッションに紐づくユーザー自身のfavoritesのみ取得できる。
 * userIdは呼び出し側の意図を明示するためのフィルタであり、実際のアクセス制御はRLSポリシーが担う。
 */
export async function listFavorites(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<FavoriteWithInstrument[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("id, created_at, instrument_id, instruments(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      instrument: row.instruments,
    }));
}

export async function addFavorite(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string
) {
  const { data, error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, instrument_id: instrumentId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFavorite(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string
) {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId);

  if (error) throw error;
}
