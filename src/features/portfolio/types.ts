import type { Currency, InstrumentType, Market } from "@/types/domain";

export type NisaType = "tsumitate" | "growth" | null;

export interface PositionApiItem {
  id: string;
  quantity: number;
  avgCost: number | null;
  nisaType: NisaType;
  isManual: boolean;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: InstrumentType;
  priceDate: string | null;
  fetchedAt: string | null;
  lastClose: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface EvaluatedPosition extends PositionApiItem {
  marketValue: number | null;
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
}

export interface PortfolioCurrencySummary {
  currency: Currency;
  positionCount: number;
  valuedCount: number;
  costedCount: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  hasValuation: boolean;
  hasCostBasis: boolean;
  isValuationComplete: boolean;
  isCostBasisComplete: boolean;
}

export type PortfolioProfitState =
  "positive" | "negative" | "flat" | "mixed" | "partial" | "unknown";
