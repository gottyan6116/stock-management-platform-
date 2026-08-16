"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Settings } from "lucide-react";
import { fetchPositions, POSITIONS_KEY } from "@/features/portfolio/api";
import { formatDateTime } from "@/lib/utils/format";

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
    ? "最終取得 確認中"
    : isError
      ? "最終取得 確認できません"
      : `最終取得 ${latestFetchedAt ? formatDateTime(latestFetchedAt) : "未取得"}`;
  const compactFreshness = isLoading
    ? "確認中"
    : isError
      ? "確認不可"
      : latestFetchedAt
        ? formatDateTime(latestFetchedAt).slice(5).replace("-", "/")
        : "未取得";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex min-h-14 w-full max-w-content items-center justify-between gap-3 px-4 md:px-6 xl:px-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text-primary">長期投資インテリジェンス</p>
          <p className="truncate text-xs text-text-secondary">判断材料を一か所で確認</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-xs text-text-secondary sm:gap-2">
          <span
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-2"
            role="status"
            aria-live="polite"
            aria-label={freshness}
          >
            <Clock3 className="h-3.5 w-3.5 text-text-muted sm:h-4 sm:w-4" aria-hidden />
            <span className="sm:hidden" aria-hidden>
              {compactFreshness}
            </span>
            <span className="hidden sm:inline" aria-hidden>
              {freshness}
            </span>
          </span>
          <Link
            href="/settings"
            aria-label="設定を開く"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-button px-2 font-semibold text-text-secondary transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:bg-primary-soft sm:px-3"
          >
            <Settings className="h-[17px] w-[17px]" aria-hidden />
            <span className="hidden sm:inline">設定</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
