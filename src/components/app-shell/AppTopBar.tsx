"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlobalStockSearch } from "@/components/search/GlobalStockSearch";
import { fetchPositions, POSITIONS_KEY } from "@/features/portfolio/api";
import { formatDateTime, formatDateTimeCompact } from "@/lib/utils/format";

/**
 * 全画面共通のヘッダー。銘柄検索（ショートカット「/」）はここに1つだけ置く。
 * 更新時刻は右端に1行だけ表示し、各ページ側には出さない（Phase 1）。
 */
export function AppTopBar() {
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: fetchPositions,
  });
  const latestFetchedAt = useMemo(
    () =>
      data
        .map((position) => position.fetchedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1),
    [data]
  );
  const freshness = isLoading
    ? "価格更新 確認中"
    : isError
      ? "価格更新 確認できません"
      : `価格更新 ${latestFetchedAt ? formatDateTime(latestFetchedAt) : "未取得"}`;
  const compactFreshness = isLoading
    ? "確認中"
    : isError
      ? "確認不可"
      : latestFetchedAt
        ? `${formatDateTimeCompact(latestFetchedAt)} JST`
        : "未取得";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex min-h-14 w-full max-w-content items-center justify-between gap-4 px-4 md:px-6 xl:px-8">
        <div className="min-w-0 flex-1">
          <GlobalStockSearch />
        </div>
        <span
          className="shrink-0 whitespace-nowrap text-xs text-text-muted"
          role="status"
          aria-live="polite"
          aria-label={freshness}
        >
          <span className="sm:hidden" aria-hidden>
            {compactFreshness}
          </span>
          <span className="hidden sm:inline" aria-hidden>
            {freshness}
          </span>
        </span>
      </div>
    </header>
  );
}
