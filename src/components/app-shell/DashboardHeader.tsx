import type { FreshnessInfo } from "@/types/domain";
import { GlobalStockSearch } from "@/components/search/GlobalStockSearch";
import { FreshnessIndicator } from "@/components/freshness/FreshnessIndicator";

export function DashboardHeader({
  title,
  freshness,
}: {
  title: string;
  freshness: FreshnessInfo;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
      <h1 className="text-2xl font-bold text-text-primary md:text-[30px]">{title}</h1>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <GlobalStockSearch />
        <FreshnessIndicator info={freshness} />
      </div>
    </header>
  );
}
