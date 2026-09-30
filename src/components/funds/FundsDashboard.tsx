"use client";

import { useMemo } from "react";
import { PiggyBank } from "lucide-react";
import { useFavorites } from "@/features/favorites/FavoritesProvider";
import { useFavoriteQuotes } from "@/features/favorites/quotes";
import { buildFavoriteStock } from "@/features/favorites/build-favorite-stock";
import { StockTable } from "@/components/tables/StockTable";
import { EmptyState } from "@/components/feedback/EmptyState";
import { TableSkeleton } from "@/components/feedback/Skeleton";

export function FundsDashboard() {
  const { favoriteInstruments, isLoading } = useFavorites();
  const { data: quotes, isLoading: quotesLoading } = useFavoriteQuotes();

  const fundStocks = useMemo(() => {
    const bySymbol = new Map((quotes ?? []).map((q) => [q.providerSymbol, q]));
    return favoriteInstruments
      .filter((i) => i.instrumentType === "fund")
      .map((i) => buildFavoriteStock(i, bySymbol.get(i.providerSymbol), new Date().toISOString()));
  }, [favoriteInstruments, quotes]);

  if (isLoading || quotesLoading) {
    return <TableSkeleton />;
  }

  if (fundStocks.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="お気に入りの投資信託がまだありません"
        description="銘柄名・コードで投資信託を検索して、お気に入りに追加してください"
        action={
          <button
            type="button"
            onClick={() => document.getElementById("global-stock-search-input")?.focus()}
            className="rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            銘柄を検索
          </button>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-3 text-lg font-bold text-text-primary">投資信託のお気に入り</p>
      <StockTable stocks={fundStocks} />
    </div>
  );
}
