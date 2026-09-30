/**
 * 答え合わせ。判断の記録から1年後・3年後に、その銘柄の実績リターンとオルカンの同期間の実績を並べる。
 * 期日前・データ不足は「未到来」「算出不可」として理由を残し、値を補間したり0にしたりしない。
 */

export type Horizon = 1 | 3;
export const HORIZONS: readonly Horizon[] = [1, 3];

export type DecisionKind = "buy" | "pass";

export interface DecisionLike {
  decision: DecisionKind;
  decidedOn: string;
  benchmarkNav: number | null;
}

export type OutcomeStatus =
  | { status: "pending"; dueDate: string }
  | { status: "unavailable"; reason: string }
  | {
      status: "ready";
      stockReturnPct: number;
      benchmarkReturnPct: number;
      /** 判断が結果として正しかったか。購入: 銘柄がオルカンを上回った。見送り: 銘柄がオルカンを上回らなかった。 */
      correct: boolean;
    };

export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y + years, m - 1, d));
  // うるう日（2/29）で翌月にずれた場合は、その月の末日に丸める。
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

export interface PricePoint {
  date: string;
  value: number;
}

/** date 以前で最も新しい点。maxGapDays より古い点は「その日の値」とみなさず null。 */
export function latestOnOrBefore(points: readonly PricePoint[], date: string, maxGapDays: number): PricePoint | null {
  let best: PricePoint | null = null;
  for (const p of points) {
    if (p.date <= date && (best === null || p.date > best.date)) best = p;
  }
  if (!best) return null;
  const gapMs = Date.parse(date) - Date.parse(best.date);
  return gapMs / 86_400_000 <= maxGapDays ? best : null;
}

export function evaluateOutcome(params: {
  record: DecisionLike;
  horizon: Horizon;
  today: string;
  /** 判断日〜期日の株価（配当込みの調整後終値）。先頭が判断日以降の最初の点、末尾が期日以前の最後の点。 */
  stockSeries: readonly PricePoint[];
  /** オルカンの基準価額の履歴（取込のたびに記録される）。 */
  benchmarkHistory: readonly PricePoint[];
}): OutcomeStatus {
  const { record, horizon, today, stockSeries, benchmarkHistory } = params;
  const dueDate = addYears(record.decidedOn, horizon);
  if (today < dueDate) return { status: "pending", dueDate };

  if (record.benchmarkNav === null) {
    return { status: "unavailable", reason: "判断時点のオルカンの基準価額が記録されていません" };
  }
  if (stockSeries.length < 2) return { status: "unavailable", reason: "期間の株価を取得できませんでした" };

  const first = stockSeries[0]!;
  const last = latestOnOrBefore(stockSeries, dueDate, 10);
  if (!last || last.date === first.date) return { status: "unavailable", reason: "期日付近の株価を取得できませんでした" };

  // 基準価額は月1回の取込で記録されるため、期日から45日以内の記録があれば使う。
  const benchmarkEnd = latestOnOrBefore(benchmarkHistory, dueDate, 45);
  if (!benchmarkEnd) return { status: "unavailable", reason: "期日付近のオルカンの基準価額が記録されていません" };
  if (!(first.value > 0) || !(record.benchmarkNav > 0)) {
    return { status: "unavailable", reason: "判断時点の価格が不正です" };
  }

  const stockReturnPct = (last.value / first.value - 1) * 100;
  const benchmarkReturnPct = (benchmarkEnd.value / record.benchmarkNav - 1) * 100;
  const beat = stockReturnPct > benchmarkReturnPct;
  return {
    status: "ready",
    stockReturnPct,
    benchmarkReturnPct,
    correct: record.decision === "buy" ? beat : !beat,
  };
}

export interface WinRate {
  evaluated: number;
  correct: number;
  /** 評価できた件数が0なら null（0%と表示しない）。 */
  ratePct: number | null;
}

export function winRate(outcomes: readonly OutcomeStatus[]): WinRate {
  const ready = outcomes.filter((o): o is Extract<OutcomeStatus, { status: "ready" }> => o.status === "ready");
  const correct = ready.filter((o) => o.correct).length;
  return {
    evaluated: ready.length,
    correct,
    ratePct: ready.length === 0 ? null : (correct / ready.length) * 100,
  };
}
