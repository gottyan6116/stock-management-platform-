export type Market = "JP" | "US";
export type Currency = "JPY" | "USD";
export type InstrumentType = "stock" | "etf" | "index" | "fund";

export interface Instrument {
  id: string;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: InstrumentType;
  sector?: string | null;
  industry?: string | null;
}

export interface Quote {
  instrumentId: string;
  priceDate: string;
  fetchedAt: string;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  trailingPE: number | null;
}

export interface DailyPrice {
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjustedClose: number | null;
  volume: number | null;
}

export interface FavoriteStock {
  instrument: Instrument;
  quote: Quote;
  return1y: number | null;
  sparkline: number[];
  favoritedAt: string;
}

export type FreshnessStatus = "ok" | "stale" | "failed" | "unknown";

export interface FreshnessInfo {
  status: FreshnessStatus;
  priceDate: string | null;
  fetchedAt: string | null;
}

export type ChartInterval = "week" | "month";
export type ChartRange = "1y" | "3y" | "5y" | "10y" | "max";
export type ChartMode = "candlestick" | "line";
