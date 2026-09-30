"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import type { FavoriteStock } from "@/types/domain";
import { ASSET_CLASS_LABEL, ASSET_CLASS_ORDER, getAssetClass, type AssetClass } from "@/lib/domain/asset-class";
import { CurrencyValue } from "./CurrencyValue";
import { PercentChange } from "./PercentChange";
import { AssetClassBadge } from "./AssetClassBadge";
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
  showAssetClassFilter = false,
  defaultSort = "changePercent",
}: {
  stocks: FavoriteStock[];
  showAssetClassFilter?: boolean;
  defaultSort?: SortKey;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [assetClassFilter, setAssetClassFilter] = useState<AssetClass | "ALL">("ALL");

  // 区分は資産クラスで絞る。市場(JP/US)で絞ると、市場がJP固定の投資信託が日本株に混ざる（Phase 0-2）。
  // 実際に存在する資産クラスだけをチップに出す（1種類しか無ければフィルタ自体を出さない）。
  const presentClasses = useMemo(
    () => ASSET_CLASS_ORDER.filter((c) => stocks.some((s) => getAssetClass(s.instrument) === c)),
    [stocks]
  );

  const filtered = useMemo(
    () =>
      stocks.filter((s) => assetClassFilter === "ALL" || getAssetClass(s.instrument) === assetClassFilter),
    [stocks, assetClassFilter]
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
        {showAssetClassFilter && presentClasses.length > 1 ? (
          <div role="group" aria-label="資産クラスフィルター" className="inline-flex gap-1 rounded-button border border-border p-0.5">
            {(["ALL", ...presentClasses] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={assetClassFilter === c}
                onClick={() => setAssetClassFilter(c)}
                className={`min-h-9 rounded-sm px-3 py-1 text-xs font-semibold ${
                  assetClassFilter === c ? "bg-primary-soft text-primary" : "text-text-secondary"
                }`}
              >
                {c === "ALL" ? "すべて" : ASSET_CLASS_LABEL[c]}
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
              資産クラス
            </th>
            <th scope="col" className="px-4 py-3">
              株価 / 基準価額
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
                      {stock.instrument.instrumentType === "fund" ? "投資信託" : `${stock.instrument.displaySymbol} · ${stock.instrument.exchange ?? "—"}`}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <AssetClassBadge assetClass={getAssetClass(stock.instrument)} />
              </td>
              <td className="px-4 py-3">
                <CurrencyValue value={stock.quote.close} currency={stock.instrument.currency} kind="price" />
                {stock.instrument.instrumentType === "fund" ? (
                  <span className="block text-[11px] text-text-muted">1万口あたり</span>
                ) : null}
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
