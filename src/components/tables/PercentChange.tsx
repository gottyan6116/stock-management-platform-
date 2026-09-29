import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Currency } from "@/types/domain";
import { formatPercent, formatSignedNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * kind="price"（既定）: 株価の前日比など。小数はそのまま（最大2桁）。
 * kind="amount" + currency="JPY": 評価損益など円の金額。整数に丸める（Phase 0-4）。
 */
export function PercentChange({
  amount,
  percent,
  kind = "price",
  currency,
}: {
  amount: number | null;
  percent: number | null;
  kind?: "amount" | "price";
  currency?: Currency;
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
      <span>{formatSignedNumber(kind === "amount" && currency === "JPY" ? Math.round(amount) : amount)}</span>
      <span>({formatPercent(percent)})</span>
    </span>
  );
}
