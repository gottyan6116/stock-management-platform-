import "server-only";
import type { Market } from "@/types/domain";
import { getYahooClient } from "./client";
import { mapYahooSearchQuoteToInstrument } from "./mapper";
import type { InstrumentSearchResult } from "../provider";
import { withRetry, withTimeout } from "../timeout";

interface YahooSearchResponse {
  quotes: unknown[];
}

export async function searchYahoo(query: string, market?: Market): Promise<InstrumentSearchResult[]> {
  const client = getYahooClient();

  const result = await withRetry(() =>
    withTimeout(
      client.search(query, {
        quotesCount: 15,
        newsCount: 0,
        enableFuzzyQuery: true,
      }) as Promise<YahooSearchResponse>
    )
  );

  return result.quotes
    .map((quote) => mapYahooSearchQuoteToInstrument(quote as Record<string, unknown>, market))
    .filter((instrument): instrument is InstrumentSearchResult => instrument !== null);
}
