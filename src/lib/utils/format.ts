import type { Currency } from "@/types/domain";

const CURRENCY_LOCALE: Record<Currency, string> = {
  JPY: "ja-JP",
  USD: "en-US",
};

const CURRENCY_FRACTION_DIGITS: Record<Currency, number> = {
  JPY: 1,
  USD: 2,
};

export function formatCurrency(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const symbol = currency === "JPY" ? "¥" : "$";
  const digits = CURRENCY_FRACTION_DIGITS[currency];
  const formatted = value.toLocaleString(CURRENCY_LOCALE[currency], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${symbol}${formatted}`;
}

export function formatPercent(value: number | null, options: { withSign?: boolean } = {}): string {
  if (value === null) return "—";
  const { withSign = true } = options;
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedNumber(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return dateStr;
}

export function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const date = new Date(isoStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}
