import type { Currency } from "@/types/domain";
import type {
  EvaluatedPosition,
  PortfolioCurrencySummary,
  PortfolioProfitState,
  PositionApiItem,
} from "@/features/portfolio/types";

export function evaluatePositions(positions: PositionApiItem[]): EvaluatedPosition[] {
  return positions.map((position) => {
    const marketValue = position.lastClose === null ? null : position.lastClose * position.quantity;
    const costBasis = position.avgCost === null ? null : position.avgCost * position.quantity;
    const unrealizedPnl =
      marketValue === null || costBasis === null ? null : marketValue - costBasis;
    const unrealizedPnlPercent =
      unrealizedPnl === null || costBasis === null || costBasis === 0
        ? null
        : (unrealizedPnl / costBasis) * 100;
    return { ...position, marketValue, costBasis, unrealizedPnl, unrealizedPnlPercent };
  });
}

export function summarizeByCurrency(rows: EvaluatedPosition[]): PortfolioCurrencySummary[] {
  const summaries = new Map<Currency, PortfolioCurrencySummary>();
  for (const row of rows) {
    const current = summaries.get(row.currency) ?? {
      currency: row.currency,
      positionCount: 0,
      valuedCount: 0,
      costedCount: 0,
      marketValue: 0,
      costBasis: 0,
      unrealizedPnl: 0,
      hasValuation: false,
      hasCostBasis: false,
      isValuationComplete: false,
      isCostBasisComplete: false,
    };
    current.positionCount += 1;
    if (row.marketValue !== null) {
      current.marketValue += row.marketValue;
      current.valuedCount += 1;
    }
    if (row.costBasis !== null && row.unrealizedPnl !== null) {
      current.costBasis += row.costBasis;
      current.unrealizedPnl += row.unrealizedPnl;
      current.costedCount += 1;
    }
    summaries.set(row.currency, current);
  }
  return [...summaries.values()].map((summary) => ({
    ...summary,
    hasValuation: summary.valuedCount > 0,
    hasCostBasis: summary.costedCount > 0,
    isValuationComplete: summary.valuedCount === summary.positionCount,
    isCostBasisComplete: summary.costedCount === summary.positionCount,
  }));
}

export function getPortfolioProfitState(
  summaries: PortfolioCurrencySummary[]
): PortfolioProfitState {
  const comparable = summaries.filter((summary) => summary.hasCostBasis);
  if (comparable.length === 0) return "unknown";
  if (summaries.some((summary) => !summary.isCostBasisComplete)) return "partial";
  const signs = new Set(comparable.map((summary) => Math.sign(summary.unrealizedPnl)));
  if (signs.size > 1) return "mixed";
  if (signs.has(1)) return "positive";
  if (signs.has(-1)) return "negative";
  return "flat";
}
