import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import {
  addYears,
  evaluateOutcome,
  HORIZONS,
  winRate,
  type Horizon,
  type OutcomeStatus,
  type PricePoint,
  type WinRate,
} from "@/lib/candidates/outcome";
import { todayJst } from "@/lib/utils/format";
import { listManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import type { DecisionRecordWithInstrument } from "@/server/repositories/candidates-repository";

export interface DecisionView {
  id: string;
  instrumentId: string;
  name: string;
  displaySymbol: string;
  decision: "buy" | "pass";
  decidedOn: string;
  price: number;
  currency: "JPY" | "USD";
  hurdlePct: number | null;
  thesisWhy: string;
  thesisWrong: string;
  /** 記録時の中立シナリオの期待年率（%）。前提が未入力だった場合は null。 */
  baseAnnualPct: number | null;
  outcomes: Record<Horizon, OutcomeStatus>;
}

export interface DecisionsResult {
  decisions: DecisionView[];
  winRates: Record<Horizon, WinRate>;
  benchmarkConfigured: boolean;
}

function baseAnnual(scenarios: unknown): number | null {
  const results = (scenarios as { results?: { base?: { totalAnnualPct?: unknown } } } | null)?.results;
  const value = results?.base?.totalAnnualPct;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 判断の記録ごとに、1年後・3年後の答え合わせを計算する。期日前の記録は価格を取りに行かない。
 * 株の実績は配当込み（調整後終値）、オルカンは記録された基準価額の履歴を使う。
 */
export async function buildDecisionsResult(
  supabase: SupabaseClient<Database>,
  records: readonly DecisionRecordWithInstrument[]
): Promise<DecisionsResult> {
  const today = todayJst();
  const provider = getMarketDataProvider();
  const benchmarkHistories = new Map<string, PricePoint[]>();

  async function benchmarkHistory(instrumentId: string | null): Promise<PricePoint[]> {
    if (!instrumentId) return [];
    const cached = benchmarkHistories.get(instrumentId);
    if (cached) return cached;
    const rows = await listManualFundPrices(supabase, instrumentId).catch(() => []);
    const points = rows.map((r) => ({ date: r.price_date, value: r.unit_price }));
    benchmarkHistories.set(instrumentId, points);
    return points;
  }

  const decisions: DecisionView[] = [];
  for (const record of records) {
    const outcomes = {} as Record<Horizon, OutcomeStatus>;
    for (const horizon of HORIZONS) {
      const due = addYears(record.decided_on, horizon);
      let stockSeries: PricePoint[] = [];
      if (today >= due && record.instruments) {
        const rows = await provider
          .getDailyPrices(record.instruments.provider_symbol, record.decided_on, due)
          .catch(() => []);
        stockSeries = rows
          .map((r) => ({ date: r.tradingDate, value: r.adjustedClose ?? r.close }))
          .filter((p): p is PricePoint => p.value !== null);
      }
      outcomes[horizon] = evaluateOutcome({
        record: {
          decision: record.decision,
          decidedOn: record.decided_on,
          benchmarkNav: record.benchmark_nav === null ? null : Number(record.benchmark_nav),
        },
        horizon,
        today,
        stockSeries,
        benchmarkHistory: await benchmarkHistory(record.benchmark_instrument_id),
      });
    }

    decisions.push({
      id: record.id,
      instrumentId: record.instrument_id,
      name: record.instruments?.name ?? "",
      displaySymbol: record.instruments?.display_symbol ?? "",
      decision: record.decision,
      decidedOn: record.decided_on,
      price: Number(record.price),
      currency: record.currency,
      hurdlePct: record.hurdle_return === null ? null : Number(record.hurdle_return),
      thesisWhy: record.thesis_why,
      thesisWrong: record.thesis_wrong,
      baseAnnualPct: baseAnnual(record.scenarios),
      outcomes,
    });
  }

  return {
    decisions,
    winRates: {
      1: winRate(decisions.map((d) => d.outcomes[1])),
      3: winRate(decisions.map((d) => d.outcomes[3])),
    },
    benchmarkConfigured: records.some((r) => r.benchmark_instrument_id !== null),
  };
}
