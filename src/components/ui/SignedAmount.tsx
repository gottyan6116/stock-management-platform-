import type { Currency } from "@/types/domain";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * 損益の表示。色だけでなく「+」「−」の符号でも良し悪しを区別する（デザイン指針）。
 * value が null（計算できない）のときは「—」。
 */
export function SignedAmount({
  value,
  currency,
  percent,
  className,
}: {
  value: number | null;
  currency: Currency;
  percent?: number | null;
  className?: string;
}) {
  if (value === null) return <span className={cn("text-text-muted", className)}>—</span>;
  const rounded = currency === "JPY" ? Math.round(value) : value;
  const tone = rounded > 0 ? "text-success-text" : rounded < 0 ? "text-danger-text" : "text-text-primary";
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  const body = formatCurrency(Math.abs(rounded), currency);
  return (
    <span className={cn("tabular-nums", tone, className)}>
      {sign}
      {body}
      {percent !== undefined && percent !== null ? (
        <span className="ml-1 text-[0.85em]">
          ({percent > 0 ? "+" : percent < 0 ? "−" : "±"}
          {formatPercent(Math.abs(percent), { withSign: false })})
        </span>
      ) : null}
    </span>
  );
}
