import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchInstruments } from "@/server/repositories/instruments-repository";
import { listFavorites } from "@/server/repositories/favorites-repository";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { dedupeSearchResults } from "@/lib/market-data/normalize";
import type { InstrumentSearchResult } from "@/lib/market-data/provider";
import { apiError } from "@/lib/errors/api-error";
import { findAliasedSymbols } from "@/config/company-aliases";

const querySchema = z.object({
  q: z.string().trim().default(""),
  market: z.enum(["JP", "US"]).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const LOCAL_RESULT_THRESHOLD = 5;

function instrumentRowToSearchResult(row: {
  provider_symbol: string;
  display_symbol: string;
  name: string;
  exchange: string | null;
  market: "JP" | "US";
  currency: "JPY" | "USD";
  instrument_type: "stock" | "etf" | "index" | "fund";
}): InstrumentSearchResult {
  return {
    providerSymbol: row.provider_symbol,
    displaySymbol: row.display_symbol,
    name: row.name,
    exchange: row.exchange,
    market: row.market,
    currency: row.currency,
    instrumentType: row.instrument_type,
  };
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);
  }
  const { q, market, limit } = parsed.data;

  if (q.length === 0) {
    return NextResponse.json({ data: [], meta: { source: "empty", query: q } });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("UNAUTHORIZED");
  }

  const localRows = await searchInstruments(supabase, q, market, limit);
  const localResults = localRows.map(instrumentRowToSearchResult);

  let providerResults: InstrumentSearchResult[] = [];
  let providerError = false;

  if (q.length >= 2 && localResults.length < LOCAL_RESULT_THRESHOLD) {
    const provider = getMarketDataProvider();

    // 日本語の通称・カタカナ社名（例:「ジョンソンアンドジョンソン」）はYahoo Financeの
    // テキスト検索では解決できないため、別名辞書から該当symbolを直接引く。
    const aliasedSymbols = findAliasedSymbols(q);
    const aliasResults = await Promise.all(
      aliasedSymbols.map((symbol) => provider.getInstrumentInfo(symbol).catch(() => null))
    );
    const resolvedAliasResults = aliasResults.filter(
      (r): r is InstrumentSearchResult => r !== null && (!market || r.market === market)
    );

    try {
      providerResults = [...resolvedAliasResults, ...(await provider.search(q, market))];
    } catch {
      providerResults = resolvedAliasResults;
      providerError = resolvedAliasResults.length === 0;
    }
  }

  const merged = dedupeSearchResults([...localResults, ...providerResults]).slice(0, limit);

  const favoriteInstrumentIds = new Set(
    (await listFavorites(supabase, user.id)).map((f) => f.instrument.id)
  );
  const localProviderSymbols = new Map(localRows.map((row) => [row.provider_symbol, row]));

  const data = merged.map((result) => {
    const localRow = localProviderSymbols.get(result.providerSymbol);
    return {
      id: localRow?.id ?? null,
      providerSymbol: result.providerSymbol,
      displaySymbol: result.displaySymbol,
      name: result.name,
      exchange: result.exchange,
      market: result.market,
      currency: result.currency,
      instrumentType: result.instrumentType,
      isFavorite: localRow ? favoriteInstrumentIds.has(localRow.id) : false,
    };
  });

  return NextResponse.json({
    data,
    meta: {
      source: providerResults.length > 0 ? "provider" : "local",
      query: q,
      providerError,
    },
  });
}
