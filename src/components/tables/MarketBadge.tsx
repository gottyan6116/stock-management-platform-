import type { Market } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const LABEL: Record<Market, string> = { JP: "日本株", US: "米国株" };
const CLASS: Record<Market, string> = {
  JP: "bg-primary-soft text-primary",
  US: "bg-text-primary/5 text-text-secondary",
};

export function MarketBadge({ market }: { market: Market }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-xs font-semibold",
        CLASS[market]
      )}
    >
      {LABEL[market]}
    </span>
  );
}
