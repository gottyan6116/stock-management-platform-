import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatPercent, formatSignedNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PercentChange({
  amount,
  percent,
}: {
  amount: number | null;
  percent: number | null;
}) {
  if (amount === null || percent === null) {
    return <span className="text-text-muted">—</span>;
  }

  const isUp = percent > 0;
  const isDown = percent < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const colorClass = isUp ? "text-success" : isDown ? "text-danger" : "text-text-muted";

  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", colorClass)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{formatSignedNumber(amount)}</span>
      <span>({formatPercent(percent)})</span>
    </span>
  );
}
