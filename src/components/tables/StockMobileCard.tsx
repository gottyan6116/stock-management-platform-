import type { FavoriteStock } from "@/types/domain";
import { CurrencyValue } from "./CurrencyValue";
import { PercentChange } from "./PercentChange";
import { AssetClassBadge } from "./AssetClassBadge";
import { getAssetClass } from "@/lib/domain/asset-class";
import { Sparkline } from "./Sparkline";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { formatPercent } from "@/lib/utils/format";

export function StockMobileCard({
  stock,
  onOpen,
}: {
  stock: FavoriteStock;
  onOpen: (providerSymbol: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(stock.instrument.providerSymbol)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(stock.instrument.providerSymbol);
        }
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-card border border-border bg-surface p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">{stock.instrument.name}</p>
          <p className="truncate text-xs text-text-muted">{stock.instrument.displaySymbol}</p>
        </div>
        <div className="flex items-center gap-2">
          <AssetClassBadge assetClass={getAssetClass(stock.instrument)} />
          <div onClick={(e) => e.stopPropagation()}>
            <FavoriteToggle instrument={stock.instrument} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <CurrencyValue value={stock.quote.close} currency={stock.instrument.currency} kind="price" />
          {stock.instrument.instrumentType === "fund" ? (
            <span className="ml-1 text-[11px] text-text-muted">1万口あたり</span>
          ) : null}
          <div className="mt-1">
            <PercentChange amount={stock.quote.change} percent={stock.quote.changePercent} />
          </div>
        </div>
        <Sparkline values={stock.sparkline} />
      </div>
      <p className="text-xs text-text-secondary">1年騰落率 {formatPercent(stock.return1y)}</p>
    </div>
  );
}
