import type { Market } from "@/types/domain";
import type {
  DailyPriceRow,
  InstrumentSearchResult,
  MarketDataProvider,
  QuoteSnapshot,
} from "../provider";

// テスト専用の固定fixture。Yahoo Financeへは一切アクセスしない（設計書39.5）。
const FIXTURE_INSTRUMENTS: InstrumentSearchResult[] = [
  {
    providerSymbol: "7203.T",
    displaySymbol: "7203",
    name: "トヨタ自動車",
    exchange: "JPX",
    market: "JP",
    currency: "JPY",
    instrumentType: "stock",
  },
  {
    providerSymbol: "AAPL",
    displaySymbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    market: "US",
    currency: "USD",
    instrumentType: "stock",
  },
];

const FIXTURE_DAILY_PRICES: Record<string, DailyPriceRow[]> = {
  "7203.T": [
    {
      providerSymbol: "7203.T",
      tradingDate: "2026-06-29",
      open: 3100,
      high: 3150,
      low: 3090,
      close: 3120,
      adjustedClose: 3120,
      volume: 1000000,
    },
    {
      providerSymbol: "7203.T",
      tradingDate: "2026-06-30",
      open: 3120,
      high: 3160,
      low: 3110,
      close: 3125,
      adjustedClose: 3125,
      volume: 1200000,
    },
  ],
  AAPL: [
    {
      providerSymbol: "AAPL",
      tradingDate: "2026-06-29",
      open: 193.5,
      high: 196.0,
      low: 193.0,
      close: 195.0,
      adjustedClose: 195.0,
      volume: 50000000,
    },
    {
      providerSymbol: "AAPL",
      tradingDate: "2026-06-30",
      open: 195.0,
      high: 196.5,
      low: 194.5,
      close: 195.27,
      adjustedClose: 195.27,
      volume: 48000000,
    },
  ],
};

export class MockMarketDataProvider implements MarketDataProvider {
  async search(query: string, market?: Market): Promise<InstrumentSearchResult[]> {
    const q = query.trim().toLowerCase();
    return FIXTURE_INSTRUMENTS.filter((instrument) => {
      if (market && instrument.market !== market) return false;
      return (
        instrument.name.toLowerCase().includes(q) ||
        instrument.displaySymbol.toLowerCase().includes(q) ||
        instrument.providerSymbol.toLowerCase().includes(q)
      );
    });
  }

  async getQuote(symbol: string): Promise<QuoteSnapshot> {
    const instrument = FIXTURE_INSTRUMENTS.find((i) => i.providerSymbol === symbol);
    const series = FIXTURE_DAILY_PRICES[symbol];
    const last = series?.[series.length - 1] ?? null;
    const prev = series && series.length > 1 ? series[series.length - 2]! : null;

    return {
      providerSymbol: symbol,
      priceDate: last?.tradingDate ?? null,
      fetchedAt: new Date().toISOString(),
      currency: instrument?.currency ?? "USD",
      close: last?.close ?? null,
      previousClose: prev?.close ?? null,
      change: last && prev && last.close !== null && prev.close !== null ? last.close - prev.close : null,
      changePercent:
        last && prev && last.close !== null && prev.close !== null && prev.close !== 0
          ? ((last.close - prev.close) / prev.close) * 100
          : null,
      dividendYield: null,
      marketCap: null,
      trailingPE: null,
      forwardPE: null,
    };
  }

  async getDailyPrices(symbol: string, from: string, to: string): Promise<DailyPriceRow[]> {
    const series = FIXTURE_DAILY_PRICES[symbol] ?? [];
    return series.filter((row) => row.tradingDate >= from && row.tradingDate <= to);
  }

  async getInstrumentInfo(symbol: string): Promise<InstrumentSearchResult | null> {
    return FIXTURE_INSTRUMENTS.find((i) => i.providerSymbol === symbol) ?? null;
  }
}
