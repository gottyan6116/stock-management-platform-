import type { Database } from "@/types/supabase";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  findInstrumentByProviderSymbol,
  upsertInstrument,
} from "@/server/repositories/instruments-repository";

type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

/**
 * providerSymbolのみからinstrumentを解決する。ローカルDBに無ければProviderへ問い合わせてupsertする
 * （お気に入り追加・保有資産登録の両方で共通して使う導線）。無効なsymbolはnullを返す。
 *
 * instrumentsは全ユーザー共有の参照テーブルで、favorites/positionsのようにuser_idを持たないため
 * RLSのinsertポリシーを持たない（読み取りのみauthenticatedへ許可）。そのため書き込みは常に
 * service roleクライアントで行う。呼び出し元がユーザーセッションのclientを渡す必要はない。
 */
export async function resolveOrCreateInstrument(
  rawProviderSymbol: string
): Promise<InstrumentRow | null> {
  const providerSymbol = normalizeProviderSymbol(rawProviderSymbol);
  const serviceClient = createServiceRoleClient();

  const existing = await findInstrumentByProviderSymbol(serviceClient, providerSymbol);
  if (existing) return existing;

  const provider = getMarketDataProvider();
  const info = await provider.getInstrumentInfo(providerSymbol);
  if (!info) return null;

  return upsertInstrument(serviceClient, {
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

function slugifyFundName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Yahoo Financeにシンボルが存在しない日本の投資信託（NISA等）を手入力で登録するための解決関数。
 * provider="manual" として、名前から生成した安定シンボルでinstrumentsをupsertする。
 * 同じ名前を再度入力した場合は同一instrumentを再利用する（名前を正規化キーとして扱う）。
 */
export async function resolveOrCreateManualFundInstrument(name: string): Promise<InstrumentRow> {
  const serviceClient = createServiceRoleClient();
  const providerSymbol = `MANUAL:${slugifyFundName(name)}`;

  const existing = await findInstrumentByProviderSymbol(serviceClient, providerSymbol, "manual");
  if (existing) return existing;

  return upsertInstrument(serviceClient, {
    provider: "manual",
    provider_symbol: providerSymbol,
    display_symbol: name,
    name,
    exchange: null,
    market: "JP",
    currency: "JPY",
    instrument_type: "fund",
  });
}
