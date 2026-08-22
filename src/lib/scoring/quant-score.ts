import type { FinancialMetric, MetricKey } from "@/types/evidence";

export interface CategoryScore {
  score: number | null;
  maxScore: number;
  reason: string;
}

export interface QuantScoreBreakdown {
  growth: CategoryScore;
  profitability: CategoryScore;
  financialHealth: CategoryScore;
  cashFlow: CategoryScore;
  valuation: CategoryScore;
  shareholderReturn: CategoryScore;
  total: number | null;
  maxTotal: number;
  // totalが実際に採点できたカテゴリの満点合計（scoreがnullのカテゴリのmaxScoreは含まない）。
  // maxTotal（常に70）に対してtotalを解釈すると、データが少ないほど不当に低スコアに見える
  // （missing != 0の原則が分母側で破られる）ため、consumer側はtotal/scoredMaxTotalで
  // 「採点できた範囲内での相対評価」を、total/maxTotalで「全体カバレッジ込みの絶対評価」を
  // 使い分けられるようにする。
  scoredMaxTotal: number | null;
}

/**
 * 指定したmetric_keyの中で最新期末日のFinancialMetricを返す（同一期末日が複数あれば最初に見つかったもの）。
 * periodTypeで絞り込む（既定FY）— 四半期値と通期値は水準が異なるため混在させない
 * （例: 四半期ROEは通期の約1/4になり得るなど、期間タイプをまたぐ比較は指標を歪める）。
 */
function latestMetric(financials: FinancialMetric[], key: MetricKey, periodType: "FY" | "Q" = "FY"): FinancialMetric | null {
  const matches = financials.filter((m) => m.metricKey === key && m.periodType === periodType);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.periodEnd >= b.periodEnd ? a : b));
}

/** 直近2つの異なる期末日（同一periodType、既定FY）のYoY成長率(%)。データ不足（異なる期が2件未満）ならnull。 */
function yoyGrowthPercent(financials: FinancialMetric[], key: MetricKey, periodType: "FY" | "Q" = "FY"): number | null {
  const matches = financials.filter((m) => m.metricKey === key && m.periodType === periodType);
  const distinctPeriods = Array.from(new Set(matches.map((m) => m.periodEnd))).sort();
  if (distinctPeriods.length < 2) return null;
  const latestPeriod = distinctPeriods[distinctPeriods.length - 1]!;
  const previousPeriod = distinctPeriods[distinctPeriods.length - 2]!;
  const latestValue = matches.find((m) => m.periodEnd === latestPeriod)?.value;
  const previousValue = matches.find((m) => m.periodEnd === previousPeriod)?.value;
  if (latestValue === undefined || previousValue === undefined || previousValue === 0) return null;
  return ((latestValue - previousValue) / Math.abs(previousValue)) * 100;
}

/** value を [low, high] の範囲で0〜1に線形正規化し、[0,1]にクランプする。invertなら反転（低いほど良い指標向け）。 */
function normalize(value: number, low: number, high: number, invert = false): number {
  const ratio = (value - low) / (high - low);
  const clamped = Math.max(0, Math.min(1, ratio));
  return invert ? 1 - clamped : clamped;
}

interface SubMetricSpec {
  key: MetricKey;
  low: number;
  high: number;
  invert?: boolean;
  // PER/PBR等、0以下は「割安」ではなく「赤字/債務超過で評価不能」を意味する指標向け。
  // invert指標にclampを先にかけると負値がlow未満→0→反転で満点になってしまうため、
  // そのような指標は正の値のときだけスコア対象にする（missing != 0を守る）。
  skipIfNonPositive?: boolean;
}

/**
 * specsで指定した各指標の直近値を[0,1]に正規化し、取得できたものだけの平均をmaxScoreに掛けて返す。
 * データが1件も取れなければ null（missing != 0 を守る — 取得できた指標だけで平均するため、
 * 一部の指標が欠けていても他方が満点ならカテゴリ満点になり得る）。
 */
function categoryScore(financials: FinancialMetric[], specs: SubMetricSpec[], maxScore: number): CategoryScore {
  const fractions: number[] = [];
  const details: string[] = [];
  for (const spec of specs) {
    const metric = latestMetric(financials, spec.key);
    if (!metric) continue;
    if (spec.skipIfNonPositive && metric.value <= 0) continue;
    fractions.push(normalize(metric.value, spec.low, spec.high, spec.invert));
    details.push(`${spec.key}=${metric.value}`);
  }
  if (fractions.length === 0) {
    return { score: null, maxScore, reason: `no data (needs one of: ${specs.map((s) => s.key).join(", ")})` };
  }
  const avgFraction = fractions.reduce((a, b) => a + b, 0) / fractions.length;
  return { score: avgFraction * maxScore, maxScore, reason: details.join(", ") };
}

// 以下の閾値はMVP向けの合理的な判断値であり、実証的に導出したものではない。
// 将来チューニングする場合もこのモジュールの型・関数シグネチャは変えずに定数だけ調整できるようにする。
const GROWTH_MAX = 15;
const PROFITABILITY_MAX = 15;
const FINANCIAL_HEALTH_MAX = 10;
const CASH_FLOW_MAX = 10;
const VALUATION_MAX = 15;
const SHAREHOLDER_RETURN_MAX = 5;

function scoreGrowth(financials: FinancialMetric[]): CategoryScore {
  const revenueGrowth = yoyGrowthPercent(financials, "revenue");
  if (revenueGrowth !== null) {
    const fraction = normalize(revenueGrowth, 0, 15);
    return { score: fraction * GROWTH_MAX, maxScore: GROWTH_MAX, reason: `revenue YoY growth ${revenueGrowth.toFixed(1)}%` };
  }
  const epsGrowth = yoyGrowthPercent(financials, "eps");
  if (epsGrowth !== null) {
    const fraction = normalize(epsGrowth, 0, 15);
    return { score: fraction * GROWTH_MAX, maxScore: GROWTH_MAX, reason: `eps YoY growth ${epsGrowth.toFixed(1)}%` };
  }
  return { score: null, maxScore: GROWTH_MAX, reason: "no data (needs revenue or eps in at least 2 periods)" };
}

export function computeQuantScore(financials: FinancialMetric[]): QuantScoreBreakdown {
  const growth = scoreGrowth(financials);
  const profitability = categoryScore(
    financials,
    [
      { key: "operating_margin", low: 0, high: 20 },
      { key: "roe", low: 0, high: 20 },
    ],
    PROFITABILITY_MAX
  );
  const financialHealth = categoryScore(
    financials,
    [
      { key: "current_ratio", low: 1, high: 2 },
      { key: "net_debt_ebitda", low: 0, high: 3, invert: true },
    ],
    FINANCIAL_HEALTH_MAX
  );
  const cashFlow = categoryScore(
    financials,
    [
      { key: "fcf_margin", low: 0, high: 15 },
      { key: "fcf_yield", low: 0, high: 8 },
    ],
    CASH_FLOW_MAX
  );
  const valuation = categoryScore(
    financials,
    [
      { key: "per", low: 10, high: 30, invert: true, skipIfNonPositive: true },
      { key: "pbr", low: 0.5, high: 3, invert: true, skipIfNonPositive: true },
    ],
    VALUATION_MAX
  );
  const shareholderReturn = categoryScore(financials, [{ key: "dividend_yield", low: 0, high: 4 }], SHAREHOLDER_RETURN_MAX);

  const categories = [growth, profitability, financialHealth, cashFlow, valuation, shareholderReturn];
  const scored = categories.filter((c): c is CategoryScore & { score: number } => c.score !== null);
  const total = scored.length > 0 ? scored.reduce((sum, c) => sum + c.score, 0) : null;
  const scoredMaxTotal = scored.length > 0 ? scored.reduce((sum, c) => sum + c.maxScore, 0) : null;

  return {
    growth,
    profitability,
    financialHealth,
    cashFlow,
    valuation,
    shareholderReturn,
    total,
    maxTotal: GROWTH_MAX + PROFITABILITY_MAX + FINANCIAL_HEALTH_MAX + CASH_FLOW_MAX + VALUATION_MAX + SHAREHOLDER_RETURN_MAX,
    scoredMaxTotal,
  };
}
