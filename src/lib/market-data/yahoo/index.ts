import "server-only";
import type { Market } from "@/types/domain";
import type { MarketDataProvider } from "../provider";
import { searchYahoo } from "./search";
import { getYahooInstrumentInfo, getYahooQuote } from "./quote";
import { getYahooDailyPrices } from "./chart";

export class YahooMarketDataProvider implements MarketDataProvider {
  search(query: string, market?: Market) {
    return searchYahoo(query, market);
  }

  getQuote(symbol: string) {
    return getYahooQuote(symbol);
  }

  getDailyPrices(symbol: string, from: string, to: string) {
    return getYahooDailyPrices(symbol, from, to);
  }

  getInstrumentInfo(symbol: string) {
    return getYahooInstrumentInfo(symbol);
  }
}
