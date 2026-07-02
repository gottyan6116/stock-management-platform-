import type { InstrumentType, Market } from "@/types/domain";
import { detectMarketFromProviderSymbol, normalizeProviderSymbol, toDisplaySymbol } from "../normalize";
import type { DailyPriceRow, InstrumentSearchResult, QuoteSnapshot } from "../provider";

// MVPで検索結果に含める種別。暗号資産・FX・投資信託・先物・オプション等は除外する（設計書11.1）。
const SUPPORTED_QUOTE_TYPES = new Set(["EQUITY", "ETF", "INDEX"]);

function toInstrumentType(quoteType: string): InstrumentType | null {
  if (quoteType === "EQUITY") return "stock";
  if (quoteType === "ETF") return "etf";
  if (quoteType === "INDEX") return "index";
  return null;
}

interface YahooSearchQuoteLike {
  symbol?: unknown;
  exchange?: unknown;
  exchDisp?: unknown;
  shortname?: unknown;
  longname?: unknown;
  quoteType?: unknown;
  isYahooFinance?: unknown;
}

export function mapYahooSearchQuoteToInstrument(
  quote: YahooSearchQuoteLike,
  marketFilter?: Market
): InstrumentSearchResult | null {
  if (quote.isYahooFinance !== true) return null;
  if (typeof quote.symbol !== "string" || typeof quote.quoteType !== "string") return null;

  const instrumentType = toInstrumentType(quote.quoteType);
  if (!instrumentType || !SUPPORTED_QUOTE_TYPES.has(quote.quoteType)) return null;

  const providerSymbol = normalizeProviderSymbol(quote.symbol);
  const market = detectMarketFromProviderSymbol(providerSymbol);
  if (marketFilter && market !== marketFilter) return null;
  // MVP対象市場（JP/US）以外の銘柄は除外する。
  if (market !== "JP" && market !== "US") return null;

  const name =
    (typeof quote.longname === "string" && quote.longname) ||
    (typeof quote.shortname === "string" && quote.shortname) ||
    "";
  if (!name) return null;

  return {
    providerSymbol,
    displaySymbol: toDisplaySymbol(providerSymbol),
    name,
    exchange: typeof quote.exchDisp === "string" ? quote.exchDisp : null,
    market,
    currency: market === "JP" ? "JPY" : "USD",
    instrumentType,
  };
}

interface YahooQuoteLike {
  symbol?: unknown;
  currency?: unknown;
  regularMarketTime?: unknown;
  regularMarketPrice?: unknown;
  regularMarketPreviousClose?: unknown;
  regularMarketChange?: unknown;
  regularMarketChangePercent?: unknown;
  dividendYield?: unknown;
  trailingAnnualDividendYield?: unknown;
  marketCap?: unknown;
  trailingPE?: unknown;
  forwardPE?: unknown;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDateOnly(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function mapYahooQuoteToSnapshot(quote: YahooQuoteLike): QuoteSnapshot {
  const providerSymbol = typeof quote.symbol === "string" ? normalizeProviderSymbol(quote.symbol) : "";
  const market = detectMarketFromProviderSymbol(providerSymbol);

  return {
    providerSymbol,
    priceDate: toDateOnly(quote.regularMarketTime),
    fetchedAt: new Date().toISOString(),
    currency: typeof quote.currency === "string" && quote.currency === "JPY" ? "JPY" : market === "JP" ? "JPY" : "USD",
    close: toNullableNumber(quote.regularMarketPrice),
    previousClose: toNullableNumber(quote.regularMarketPreviousClose),
    change: toNullableNumber(quote.regularMarketChange),
    changePercent: toNullableNumber(quote.regularMarketChangePercent),
    dividendYield: toNullableNumber(quote.dividendYield ?? quote.trailingAnnualDividendYield),
    marketCap: toNullableNumber(quote.marketCap),
    trailingPE: toNullableNumber(quote.trailingPE),
    forwardPE: toNullableNumber(quote.forwardPE),
  };
}

interface YahooChartQuoteLike {
  date?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  adjclose?: unknown;
  volume?: unknown;
}

export function mapYahooChartQuoteToDailyPrice(
  providerSymbol: string,
  quote: YahooChartQuoteLike
): DailyPriceRow | null {
  if (!(quote.date instanceof Date) || Number.isNaN(quote.date.getTime())) return null;

  return {
    providerSymbol,
    tradingDate: quote.date.toISOString().slice(0, 10),
    open: toNullableNumber(quote.open),
    high: toNullableNumber(quote.high),
    low: toNullableNumber(quote.low),
    close: toNullableNumber(quote.close),
    adjustedClose: toNullableNumber(quote.adjclose) ?? toNullableNumber(quote.close),
    volume: toNullableNumber(quote.volume),
  };
}
