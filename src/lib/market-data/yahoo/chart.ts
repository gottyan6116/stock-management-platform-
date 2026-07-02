import "server-only";
import { normalizeProviderSymbol } from "../normalize";
import { getYahooClient } from "./client";
import { mapYahooChartQuoteToDailyPrice } from "./mapper";
import type { DailyPriceRow } from "../provider";
import { withRetry, withTimeout } from "../timeout";

interface YahooChartResponse {
  quotes: unknown[];
}

export async function getYahooDailyPrices(
  symbol: string,
  from: string,
  to: string
): Promise<DailyPriceRow[]> {
  const client = getYahooClient();
  const providerSymbol = normalizeProviderSymbol(symbol);

  const result = await withRetry(() =>
    withTimeout(
      client.chart(providerSymbol, {
        period1: from,
        period2: to,
        interval: "1d",
      }) as Promise<YahooChartResponse>
    )
  );

  return result.quotes
    .map((quote) => mapYahooChartQuoteToDailyPrice(providerSymbol, quote as Record<string, unknown>))
    .filter((row): row is DailyPriceRow => row !== null);
}
