import type { Currency, InstrumentType, Market } from "@/types/domain";

export interface InstrumentSearchResult {
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: InstrumentType;
}

export interface QuoteSnapshot {
  providerSymbol: string;
  priceDate: string | null;
  fetchedAt: string;
  currency: Currency;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
}

export interface DailyPriceRow {
  providerSymbol: string;
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjustedClose: number | null;
  volume: number | null;
}

export interface MarketDataProvider {
  search(query: string, market?: Market): Promise<InstrumentSearchResult[]>;
  getQuote(symbol: string): Promise<QuoteSnapshot>;
  getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPriceRow[]>;
  /** お気に入り初回追加時、providerSymbolのみからinstrumentをupsertするための正確な単体解決。 */
  getInstrumentInfo(symbol: string): Promise<InstrumentSearchResult | null>;
}
