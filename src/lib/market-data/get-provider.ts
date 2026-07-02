import "server-only";
import type { MarketDataProvider } from "./provider";
import { YahooMarketDataProvider } from "./yahoo";
import { MockMarketDataProvider } from "./mock/provider";

let cached: MarketDataProvider | null = null;

export function getMarketDataProvider(): MarketDataProvider {
  if (!cached) {
    cached = process.env.MARKET_DATA_PROVIDER === "mock"
      ? new MockMarketDataProvider()
      : new YahooMarketDataProvider();
  }
  return cached;
}
