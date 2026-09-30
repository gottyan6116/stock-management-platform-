import { useQuery } from "@tanstack/react-query";

/** /api/favorites/quotes の1件分。保有画面(/api/positions)と同じ instrument-price を経由した実データ。 */
export interface FavoriteQuoteApiItem {
  providerSymbol: string;
  /** 表示価格。株式は終値、投資信託は1万口あたりの基準価額。 */
  displayPrice: number | null;
  unitDivisor: number;
  previousPrice: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  priceDate: string | null;
  fetchedAt: string | null;
  return1y: number | null;
  sparkline: number[];
}

export const FAVORITE_QUOTES_KEY = ["favorite-quotes"] as const;

export async function fetchFavoriteQuotes(): Promise<FavoriteQuoteApiItem[]> {
  const res = await fetch("/api/favorites/quotes");
  if (!res.ok) throw new Error(`favorite quotes request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export function useFavoriteQuotes() {
  return useQuery({ queryKey: FAVORITE_QUOTES_KEY, queryFn: fetchFavoriteQuotes, staleTime: 60_000 });
}
