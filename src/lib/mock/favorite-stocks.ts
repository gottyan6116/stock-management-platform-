import type { FavoriteStock, Instrument, Quote } from "@/types/domain";
import { generateMockDailySeries } from "./series";
import { aggregateWeekly } from "@/lib/aggregation/aggregate";

const BASE_PRICE: Record<string, number> = {
  "7203.T": 3125,
  "8306.T": 1846.5,
  "9984.T": 8765,
  "8035.T": 37950,
  "7974.T": 8021,
  AAPL: 195.27,
  NVDA: 953.86,
  MSFT: 449.35,
  AMZN: 186.24,
  GOOGL: 168.18,
};

const DIVIDEND_YIELD: Record<string, number | null> = {
  "7203.T": 2.7,
  "8306.T": 3.22,
  "9984.T": 0.43,
  "8035.T": 1.23,
  "7974.T": 1.48,
  AAPL: 0.55,
  NVDA: 0.13,
  MSFT: 0.76,
  AMZN: null,
  GOOGL: 0.47,
};

const TODAY = new Date().toISOString().slice(0, 10);
const FETCHED_AT = new Date().toISOString();

export function buildMockFavoriteStock(instrument: Instrument, favoritedAt: string): FavoriteStock {
  const basePrice = BASE_PRICE[instrument.providerSymbol] ?? 100;
  const daily = generateMockDailySeries(instrument.providerSymbol, 260 * 3, basePrice);
  const last = daily[daily.length - 1]!;
  const prev = daily[daily.length - 2]!;
  const oneYearAgoIndex = Math.max(0, daily.length - 253);
  const oneYearAgo = daily[oneYearAgoIndex]!;

  const change = last.close! - prev.close!;
  const changePercent = (change / prev.close!) * 100;
  const return1y = ((last.adjustedClose! - oneYearAgo.adjustedClose!) / oneYearAgo.adjustedClose!) * 100;

  const quote: Quote = {
    instrumentId: instrument.id,
    priceDate: TODAY,
    fetchedAt: FETCHED_AT,
    close: last.close,
    previousClose: prev.close,
    change,
    changePercent,
    dividendYield: DIVIDEND_YIELD[instrument.providerSymbol] ?? null,
    marketCap: null,
    trailingPE: null,
  };

  const weekly = aggregateWeekly(daily.slice(-260));
  const sparkline = weekly.map((w) => w.adjustedClose ?? 0);

  return { instrument, quote, return1y, sparkline, favoritedAt };
}

export function buildMockDailySeriesFor(instrument: Instrument, tradingDays: number) {
  const basePrice = BASE_PRICE[instrument.providerSymbol] ?? 100;
  return generateMockDailySeries(instrument.providerSymbol, tradingDays, basePrice);
}
