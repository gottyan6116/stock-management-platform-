import { marketValueOf, type InstrumentPrice } from "@/lib/pricing/instrument-price";
import type { NisaType } from "@/features/portfolio/types";

/** 1銘柄の保有ロット（口座ごとの1行）。avgCost は displayPrice と同じ単位（株=1株、投信=1万口あたり）。 */
export interface HoldingLot {
  quantity: number;
  avgCost: number | null;
  nisaType: NisaType;
}

export interface HoldingSummary {
  quantity: number;
  /** 数量加重の平均取得単価。1ロットでも取得単価が無ければ null（0とみなして損益を歪めない）。 */
  avgCost: number | null;
  marketValue: number | null;
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  lots: HoldingLot[];
}

/** 銘柄詳細の「自分の保有状況」。保有していなければ null。 */
export function summarizeHolding(lots: readonly HoldingLot[], price: InstrumentPrice): HoldingSummary | null {
  if (lots.length === 0) return null;
  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const allHaveCost = lots.every((lot) => lot.avgCost !== null);
  const costUnits = allHaveCost ? lots.reduce((sum, lot) => sum + lot.quantity * lot.avgCost!, 0) : null;
  const avgCost = costUnits !== null && quantity > 0 ? costUnits / quantity : null;
  const costBasis = costUnits !== null ? costUnits / price.unitDivisor : null;
  const marketValue = marketValueOf(quantity, price);
  const unrealizedPnl = marketValue !== null && costBasis !== null ? marketValue - costBasis : null;
  const unrealizedPnlPercent =
    unrealizedPnl !== null && costBasis !== null && costBasis !== 0 ? (unrealizedPnl / costBasis) * 100 : null;
  return { quantity, avgCost, marketValue, costBasis, unrealizedPnl, unrealizedPnlPercent, lots: [...lots] };
}
