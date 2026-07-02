"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import type { FavoriteStock, Market } from "@/types/domain";
import { CurrencyValue } from "./CurrencyValue";
import { PercentChange } from "./PercentChange";
import { MarketBadge } from "./MarketBadge";
import { Sparkline } from "./Sparkline";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { StockMobileCard } from "./StockMobileCard";
import { formatPercent } from "@/lib/utils/format";

type SortKey = "name" | "changePercent" | "return1y" | "dividendYield" | "favoritedAt";
type SortOrder = "asc" | "desc";

const SORT_LABEL: Record<SortKey, string> = {
  name: "銘柄名",
  changePercent: "前営業日比",
  return1y: "1年騰落率",
  dividendYield: "配当利回り",
  favoritedAt: "お気に入り追加日",
};

function sortValue(stock: FavoriteStock, key: SortKey): number | string {
  switch (key) {
    case "name":
      return stock.instrument.name;
    case "changePercent":
      return stock.quote.changePercent ?? -Infinity;
    case "return1y":
      return stock.return1y ?? -Infinity;
    case "dividendYield":
      return stock.quote.dividendYield ?? -Infinity;
    case "favoritedAt":
      return stock.favoritedAt;
  }
}

export function StockTable({
  stocks,
  showMarketFilter = false,
  defaultSort = "changePercent",
}: {
  stocks: FavoriteStock[];
  showMarketFilter?: boolean;
  defaultSort?: SortKey;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [marketFilter, setMarketFilter] = useState<Market | "ALL">("ALL");

  const filtered = useMemo(
    () => stocks.filter((s) => marketFilter === "ALL" || s.instrument.market === marketFilter),
    [stocks, marketFilter]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortOrder]);

  function goToDetail(providerSymbol: string) {
    router.push(`/stocks/${encodeURIComponent(providerSymbol)}`);
  }

  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        {showMarketFilter ? (
          <div role="group" aria-label="市場フィルター" className="inline-flex gap-1 rounded-button border border-border p-0.5">
            {(["ALL", "JP", "US"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={marketFilter === m}
                onClick={() => setMarketFilter(m)}
                className={`rounded-sm px-3 py-1 text-xs font-semibold ${
                  marketFilter === m ? "bg-primary-soft text-primary" : "text-text-secondary"
                }`}
              >
                {m === "ALL" ? "すべて" : m === "JP" ? "日本株" : "米国株"}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
          <label htmlFor="sort-key" className="sr-only">
            並び替え
          </label>
          <select
            id="sort-key"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-sm border border-border bg-surface px-2 py-1"
          >
            {Object.entries(SORT_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="rounded-sm border border-border px-2 py-1 font-semibold"
          >
            {sortOrder === "asc" ? "昇順" : "降順"}
          </button>
        </div>
      </div>

      {/* デスクトップ: テーブル */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="text-left text-xs font-semibold text-text-muted">
            <th scope="col" className="px-4 py-3">
              銘柄
            </th>
            <th scope="col" className="px-4 py-3">
              市場
            </th>
            <th scope="col" className="px-4 py-3">
              最新終値
            </th>
            <th scope="col" className="px-4 py-3">
              前営業日比
            </th>
            <th scope="col" className="px-4 py-3">
              1年騰落率
            </th>
            <th scope="col" className="px-4 py-3">
              チャート(1年)
            </th>
            <th scope="col" className="px-4 py-3">
              配当利回り
            </th>
            <th scope="col" className="px-4 py-3">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((stock) => (
            <tr
              key={stock.instrument.id}
              onClick={() => goToDetail(stock.instrument.providerSymbol)}
              className="min-h-[60px] cursor-pointer border-t border-border hover:bg-surface-subtle"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {stock.instrument.displaySymbol.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{stock.instrument.name}</p>
                    <p className="truncate text-xs text-text-muted">
                      {stock.instrument.displaySymbol} · {stock.instrument.exchange}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <MarketBadge market={stock.instrument.market} />
              </td>
              <td className="px-4 py-3">
                <CurrencyValue value={stock.quote.close} currency={stock.instrument.currency} />
              </td>
              <td className="px-4 py-3">
                <PercentChange amount={stock.quote.change} percent={stock.quote.changePercent} />
              </td>
              <td className="px-4 py-3 tabular-nums">{formatPercent(stock.return1y)}</td>
              <td className="px-4 py-3">
                <Sparkline values={stock.sparkline} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                {stock.quote.dividendYield !== null ? `${stock.quote.dividendYield.toFixed(2)}%` : "—"}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <FavoriteToggle instrument={stock.instrument} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* モバイル: カードリスト */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {sorted.map((stock) => (
          <StockMobileCard key={stock.instrument.id} stock={stock} onOpen={goToDetail} />
        ))}
      </div>
    </div>
  );
}
