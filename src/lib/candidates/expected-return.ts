/**
 * 期待リターンの分解（年率・5年）。株価そのものの予測ではなく、入力した前提から
 * 「その前提が全部当たったらこうなる」を計算するだけの式。前提と式は画面に常に表示する。
 *
 *   価格の年率  = (1 + EPS成長率) × (1 + バリュエーション年率変化) − 1
 *   バリュエーション年率変化 = (5年後PER ÷ 現在PER)^(1/5) − 1
 *   期待年率    ≒ 配当利回り + 価格の年率        （配当は再投資しない近似）
 *   5年累計     = (1 + 期待年率)^5 − 1
 */

export const HORIZON_YEARS = 5;

export const SCENARIO_KEYS = ["bear", "base", "bull"] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  bear: "弱気",
  base: "中立",
  bull: "強気",
};

/** 1シナリオの入力（%は「5」で5%）。空欄は null。 */
export interface ScenarioInput {
  /** 1株利益（EPS）の年率成長率（%） */
  epsGrowthPct: number | null;
  /** 5年後に想定するPER（倍） */
  exitPer: number | null;
}

export interface ScenarioResult {
  /** 配当利回り（%）。自動取得値。 */
  dividendPct: number | null;
  epsGrowthPct: number | null;
  /** バリュエーション変化の年率換算（%） */
  valuationPct: number | null;
  /** 価格の年率（EPS成長 × バリュエーション変化）（%） */
  priceCagrPct: number | null;
  /** 期待年率（%）。配当利回りが無い場合は配当0として扱わず null。 */
  totalAnnualPct: number | null;
  /** 5年累計（%） */
  fiveYearTotalPct: number | null;
  /** 計算できなかった理由（画面に出す）。計算できたら null。 */
  missing: string | null;
}

const isPositive = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;
const isNumber = (v: number | null): v is number => v !== null && Number.isFinite(v);

export function computeScenario(params: {
  dividendYieldPct: number | null;
  currentPer: number | null;
  input: ScenarioInput;
}): ScenarioResult {
  const { dividendYieldPct, currentPer, input } = params;
  const empty: ScenarioResult = {
    dividendPct: dividendYieldPct,
    epsGrowthPct: input.epsGrowthPct,
    valuationPct: null,
    priceCagrPct: null,
    totalAnnualPct: null,
    fiveYearTotalPct: null,
    missing: null,
  };

  if (!isNumber(input.epsGrowthPct)) return { ...empty, missing: "EPS成長率を入力してください" };
  if (!isPositive(currentPer)) {
    return { ...empty, missing: "現在PERが取得できない（赤字など）ため、PERの前提は使えません" };
  }
  if (!isPositive(input.exitPer)) return { ...empty, missing: "5年後PERを入力してください" };
  if (!isNumber(dividendYieldPct)) return { ...empty, missing: "配当利回りを取得できませんでした" };
  if (input.epsGrowthPct <= -100) return { ...empty, missing: "EPS成長率は−100%より大きい値にしてください" };

  const valuation = Math.pow(input.exitPer / currentPer, 1 / HORIZON_YEARS) - 1;
  const priceCagr = (1 + input.epsGrowthPct / 100) * (1 + valuation) - 1;
  const total = dividendYieldPct / 100 + priceCagr;
  return {
    ...empty,
    valuationPct: valuation * 100,
    priceCagrPct: priceCagr * 100,
    totalAnnualPct: total * 100,
    fiveYearTotalPct: (Math.pow(1 + total, HORIZON_YEARS) - 1) * 100,
  };
}

/** ハードルとの差（pt）。どちらかが無ければ null。 */
export function excessOverHurdle(totalAnnualPct: number | null, hurdlePct: number | null): number | null {
  if (totalAnnualPct === null || hurdlePct === null) return null;
  return totalAnnualPct - hurdlePct;
}
