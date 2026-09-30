import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

export type CandidateStatus = Database["public"]["Tables"]["favorites"]["Row"]["status"];

export interface FavoriteWithInstrument {
  id: string;
  createdAt: string;
  status: CandidateStatus;
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
    .select("id, created_at, status, instrument_id, instruments(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
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

/** 候補の状態を更新する。対象が自分のお気に入りでなければ false（RLSとuser_id絞り込みの両方で保護）。 */
export async function updateFavoriteStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string,
  status: CandidateStatus
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favorites")
    .update({ status })
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
