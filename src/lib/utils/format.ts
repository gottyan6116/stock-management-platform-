import type { Currency } from "@/types/domain";

const CURRENCY_LOCALE: Record<Currency, string> = {
  JPY: "ja-JP",
  USD: "en-US",
};

const CURRENCY_SYMBOL: Record<Currency, string> = { JPY: "¥", USD: "$" };

function withSymbol(currency: Currency, formatted: string): string {
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
}

/**
 * 金額（評価額・損益・総資産など）。円は整数、USDは小数2桁（Phase 0-4）。
 * 株価・基準価額のような「価格」は formatPrice を使う。
 */
export function formatCurrency(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const digits = currency === "JPY" ? 0 : 2;
  const formatted = value.toLocaleString(CURRENCY_LOCALE[currency], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return withSymbol(currency, formatted);
}

/**
 * 価格（株価・基準価額）。円は呼値に合わせて最大小数1桁（171.0→¥171、240.7→¥240.7）、
 * USDは小数2桁。金額と違い、実際に端数がある価格は端数を隠さない。
 */
export function formatPrice(value: number | null, currency: Currency): string {
  if (value === null) return "—";
  const formatted =
    currency === "JPY"
      ? value.toLocaleString(CURRENCY_LOCALE.JPY, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
      : value.toLocaleString(CURRENCY_LOCALE.USD, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol(currency, formatted);
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

// サーバー(Vercel=UTC)とブラウザ(JST)で getHours() の結果が食い違い、同じ時刻が
// 「12:04」と「03:04」で並ぶ不具合があった（Phase 0-5）。実行環境のタイムゾーンに依存せず
// 常に Asia/Tokyo で整形する。hourCycle: h23 は深夜0時を「24:xx」と出す実装差を避けるため。
const JST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function jstParts(isoStr: string): { y: string; m: string; d: string; hh: string; mm: string } | null {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(JST_PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: parts.year!, m: parts.month!, d: parts.day!, hh: parts.hour!, mm: parts.minute! };
}

/** 例: 2026-09-29 12:04 JST */
export function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const p = jstParts(isoStr);
  if (!p) return "—";
  return `${p.y}-${p.m}-${p.d} ${p.hh}:${p.mm} JST`;
}

/** 狭い画面向け。例: 09/29 12:04（JST。JST表記は呼び出し側のaria-label等で補う） */
export function formatDateTimeCompact(isoStr: string | null): string {
  if (!isoStr) return "—";
  const p = jstParts(isoStr);
  if (!p) return "—";
  return `${p.m}/${p.d} ${p.hh}:${p.mm}`;
}

/** 今日の日付（JST, YYYY-MM-DD）。サーバー(UTC)でもブラウザでも同じ結果になる。 */
export function todayJst(now: Date = new Date()): string {
  const p = jstParts(now.toISOString());
  return `${p!.y}-${p!.m}-${p!.d}`;
}
