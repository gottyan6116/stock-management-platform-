import "server-only";
import { getYahooClient } from "./client";
import { mapYahooQuoteToInstrumentInfo, mapYahooQuoteToSnapshot } from "./mapper";
import type { InstrumentSearchResult, QuoteSnapshot } from "../provider";
import { withRetry, withTimeout } from "../timeout";

export async function getYahooQuote(symbol: string): Promise<QuoteSnapshot> {
  const client = getYahooClient();

  const quote = await withRetry(() => withTimeout(client.quote(symbol)));

  return mapYahooQuoteToSnapshot(quote as Record<string, unknown>);
}

export async function getYahooInstrumentInfo(symbol: string): Promise<InstrumentSearchResult | null> {
  const client = getYahooClient();

  try {
    const quote = await withRetry(() => withTimeout(client.quote(symbol)));
    return mapYahooQuoteToInstrumentInfo(quote as Record<string, unknown>);
  } catch {
    return null;
  }
}
