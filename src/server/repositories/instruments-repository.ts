import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Market } from "@/types/domain";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];
type InstrumentInsert = Database["public"]["Tables"]["instruments"]["Insert"];

/** ローカルDB内のinstrumentsを名前・表示コード・provider symbolで部分一致検索する（設計書11.3 手順1）。 */
export async function searchInstruments(
  supabase: SupabaseClient<Database>,
  query: string,
  market?: Market,
  limit = 10
): Promise<InstrumentRow[]> {
  let request = supabase
    .from("instruments")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,display_symbol.ilike.%${query}%,provider_symbol.ilike.%${query}%`)
    .limit(limit);

  if (market) {
    request = request.eq("market", market);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

/** 自分が過去に手入力登録した投資信託（provider='manual'）のみを名前で検索する。新規発見用ではなく、既存登録の再選択用。 */
export async function searchManualFundInstruments(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 10
): Promise<InstrumentRow[]> {
  let request = supabase
    .from("instruments")
    .select("*")
    .eq("is_active", true)
    .eq("provider", "manual")
    .order("name")
    .limit(limit);

  if (query.length > 0) {
    request = request.ilike("name", `%${query}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function findInstrumentByProviderSymbol(
  supabase: SupabaseClient<Database>,
  providerSymbol: string,
  provider = "yahoo"
): Promise<InstrumentRow | null> {
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("provider", provider)
    .eq("provider_symbol", providerSymbol)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertInstrument(
  supabase: SupabaseClient<Database>,
  instrument: InstrumentInsert
): Promise<InstrumentRow> {
  const { data, error } = await supabase
    .from("instruments")
    .upsert(instrument, { onConflict: "provider,provider_symbol" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
