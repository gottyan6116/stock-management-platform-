import type { Currency } from "@/types/domain";
import { formatCurrency, formatPrice } from "@/lib/utils/format";

/**
 * kind="amount"（既定）: 評価額・損益など。円は整数。
 * kind="price": 株価・基準価額。円は呼値に合わせて最大小数1桁（Phase 0-4）。
 */
export function CurrencyValue({
  value,
  currency,
  kind = "amount",
}: {
  value: number | null;
  currency: Currency;
  kind?: "amount" | "price";
}) {
  const text = kind === "price" ? formatPrice(value, currency) : formatCurrency(value, currency);
  return <span className="tabular-nums">{text}</span>;
}
