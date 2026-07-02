import type { Currency } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/format";

export function CurrencyValue({ value, currency }: { value: number | null; currency: Currency }) {
  return <span className="tabular-nums">{formatCurrency(value, currency)}</span>;
}
