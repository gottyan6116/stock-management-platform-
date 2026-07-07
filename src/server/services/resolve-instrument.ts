import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import {
  findInstrumentByProviderSymbol,
  upsertInstrument,
} from "@/server/repositories/instruments-repository";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

/**
 * providerSymbolのみからinstrumentを解決する。ローカルDBに無ければProviderへ問い合わせてupsertする
 * （お気に入り追加・保有資産登録の両方で共通して使う導線）。無効なsymbolはnullを返す。
 */
export async function resolveOrCreateInstrument(
  supabase: SupabaseClient<Database>,
  rawProviderSymbol: string
): Promise<InstrumentRow | null> {
  const providerSymbol = normalizeProviderSymbol(rawProviderSymbol);

  const existing = await findInstrumentByProviderSymbol(supabase, providerSymbol);
  if (existing) return existing;

  const provider = getMarketDataProvider();
  const info = await provider.getInstrumentInfo(providerSymbol);
  if (!info) return null;

  return upsertInstrument(supabase, {
    provider: "yahoo",
    provider_symbol: info.providerSymbol,
    display_symbol: info.displaySymbol,
    name: info.name,
    exchange: info.exchange,
    market: info.market,
    currency: info.currency,
    instrument_type: info.instrumentType,
  });
}
