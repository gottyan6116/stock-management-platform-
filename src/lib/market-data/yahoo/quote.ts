import "server-only";
import { getYahooClient } from "./client";
import { mapYahooQuoteToSnapshot } from "./mapper";
import type { QuoteSnapshot } from "../provider";
import { withRetry, withTimeout } from "../timeout";

export async function getYahooQuote(symbol: string): Promise<QuoteSnapshot> {
  const client = getYahooClient();

  const quote = await withRetry(() => withTimeout(client.quote(symbol)));

  return mapYahooQuoteToSnapshot(quote as Record<string, unknown>);
}
