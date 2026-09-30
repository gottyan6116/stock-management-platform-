import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { computeScenario, SCENARIO_KEYS, type ScenarioResult } from "@/lib/candidates/expected-return";
import type { ScenarioInputs } from "@/lib/candidates/scenarios";
import { listLatestManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";

export interface DecisionMarket {
  price: number | null;
  priceDate: string | null;
  currency: "JPY" | "USD";
  /** 配当利回り（%）。自動取得。 */
  dividendYieldPct: number | null;
  /** 現在PER（実績）。赤字などで無い場合は null。 */
  currentPer: number | null;
}

/** 判断シートに使う市場データ。取れない項目は null（0や推定値で埋めない）。 */
export async function getDecisionMarket(providerSymbol: string, currency: "JPY" | "USD"): Promise<DecisionMarket> {
  const quote = await getMarketDataProvider()
    .getQuote(providerSymbol)
    .catch(() => null);
  return {
    price: quote?.close ?? null,
    priceDate: quote?.priceDate ?? null,
    currency,
    dividendYieldPct: quote?.dividendYield ?? null,
    currentPer: quote?.trailingPE !== null && quote?.trailingPE !== undefined && quote.trailingPE > 0 ? quote.trailingPE : null,
  };
}

export function computeAllScenarios(market: DecisionMarket, inputs: ScenarioInputs): Record<string, ScenarioResult> {
  return Object.fromEntries(
    SCENARIO_KEYS.map((key) => [
      key,
      computeScenario({ dividendYieldPct: market.dividendYieldPct, currentPer: market.currentPer, input: inputs[key] }),
    ])
  );
}

export interface BenchmarkInfo {
  instrumentId: string;
  name: string;
  /** 1万口あたり基準価額（最新） */
  nav: number | null;
  navDate: string | null;
}

/** 設定で選んだオルカン銘柄の最新の基準価額。未設定なら null。 */
export async function getBenchmarkInfo(
  supabase: SupabaseClient<Database>,
  benchmarkInstrumentId: string | null
): Promise<BenchmarkInfo | null> {
  if (!benchmarkInstrumentId) return null;
  const { data: instrument } = await supabase
    .from("instruments")
    .select("id, name")
    .eq("id", benchmarkInstrumentId)
    .maybeSingle();
  if (!instrument) return null;

  const history = await listLatestManualFundPrices(supabase, benchmarkInstrumentId, 1).catch(() => []);
  return {
    instrumentId: instrument.id,
    name: instrument.name,
    nav: history[0]?.unit_price ?? null,
    navDate: history[0]?.price_date ?? null,
  };
}
