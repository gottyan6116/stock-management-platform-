import { FUND_UNIT_DIVISOR } from "@/lib/domain/asset-class";

/**
 * 銘柄の「表示用価格」。全画面（保有・お気に入り・詳細）がこの1つの形を経由することで、
 * 同一銘柄の価格が画面ごとにズレないようにする（Phase 0-1 / 0-3）。
 *
 * - 株式・ETF: displayPrice = 終値、unitDivisor = 1
 * - 投資信託:  displayPrice = 1万口あたりの基準価額、unitDivisor = 10,000
 */
export interface InstrumentPrice {
  displayPrice: number | null;
  unitDivisor: number;
  priceDate: string | null;
}

export function stockPrice(close: number | null, priceDate: string | null): InstrumentPrice {
  return { displayPrice: close, unitDivisor: 1, priceDate };
}

export interface FundPositionPrice {
  manualUnitPrice: number | null;
  manualPriceDate: string | null;
}

export interface FundPriceHistoryPoint {
  unitPrice: number;
  priceDate: string;
}

/**
 * 基準価額は保有ロット（positions.manual_unit_price）と、instrument単位の履歴
 * （manual_fund_prices）の2か所に記録され得る。履歴を更新してもロット側は古いままなので、
 * 日付の新しい方を採用して「同じファンドなのに画面ごとに基準価額が違う」状態を防ぐ。
 */
export function fundPrice(position: FundPositionPrice, latestHistory: FundPriceHistoryPoint | null): InstrumentPrice {
  const own =
    position.manualUnitPrice !== null
      ? { unitPrice: position.manualUnitPrice, priceDate: position.manualPriceDate }
      : null;

  let chosen: { unitPrice: number; priceDate: string | null } | null = own;
  if (latestHistory && (!own || own.priceDate === null || latestHistory.priceDate > own.priceDate)) {
    chosen = latestHistory;
  }

  return {
    displayPrice: chosen ? chosen.unitPrice : null,
    unitDivisor: FUND_UNIT_DIVISOR,
    priceDate: chosen ? chosen.priceDate : null,
  };
}

/** 評価額。価格が無ければ null（0にしない）。口数×表示価格÷単位で、1口あたりへ割ってから掛ける丸め誤差を避ける。 */
export function marketValueOf(quantity: number, price: InstrumentPrice): number | null {
  if (price.displayPrice === null) return null;
  return (quantity * price.displayPrice) / price.unitDivisor;
}
