import type { Currency, InstrumentType, Market } from "@/types/domain";
import type { AssetClass } from "@/lib/domain/asset-class";

export type NisaType = "tsumitate" | "growth" | null;

export interface PositionApiItem {
  id: string;
  instrumentId: string;
  quantity: number;
  avgCost: number | null;
  nisaType: NisaType;
  /** 旧つみたてNISA（2023年までの制度）。新NISAの生涯投資枠には含めない。 */
  nisaLegacy: boolean;
  isManual: boolean;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: InstrumentType;
  /** 資産クラス（投資信託／日本株／米国株）。market とは独立した属性（Phase 0-2）。 */
  assetClass: AssetClass;
  priceDate: string | null;
  fetchedAt: string | null;
  /**
   * 画面に表示する価格。株式は終値、投資信託は「1万口あたり」の基準価額（Phase 0-3）。
   * 評価額は quantity × displayPrice ÷ unitDivisor で求める。
   */
  displayPrice: number | null;
  /** displayPrice が何単位あたりか。株式=1、投資信託=10,000。 */
  unitDivisor: number;
  /** 1単位（1株・1口）あたりの価格。displayPrice / unitDivisor。 */
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
