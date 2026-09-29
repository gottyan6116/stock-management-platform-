import Link from "next/link";
import type { HoldingSummary } from "@/features/portfolio/holding-summary";
import type { Currency } from "@/types/domain";
import { formatCurrency, formatPercent, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const NISA_LABEL = { tsumitate: "つみたて投資枠", growth: "成長投資枠" } as const;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-text-primary">{children}</dd>
    </div>
  );
}

/** 銘柄詳細の「自分の保有状況」（数量・取得単価・評価額・損益）。損益は色だけでなく±の符号でも区別する。 */
export function HoldingStatusPanel({
  summary,
  currency,
  isFund,
}: {
  summary: HoldingSummary | null;
  currency: Currency;
  isFund: boolean;
}) {
  if (!summary) {
    return (
      <section aria-labelledby="holding-status-heading" className="rounded-card border border-border bg-surface p-4">
        <h2 id="holding-status-heading" className="text-sm font-bold text-text-primary">
          自分の保有状況
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          この銘柄は保有していません。
          <Link href="/portfolio" className="ml-1 font-semibold text-primary hover:underline">
            保有資産から追加
          </Link>
        </p>
      </section>
    );
  }

  const pnl = summary.unrealizedPnl;
  const pnlTone = pnl === null || pnl === 0 ? "text-text-primary" : pnl > 0 ? "text-success-text" : "text-danger-text";
  const unit = isFund ? "口" : "株";

  return (
    <section aria-labelledby="holding-status-heading" className="rounded-card border border-border bg-surface p-4">
      <h2 id="holding-status-heading" className="text-sm font-bold text-text-primary">
        自分の保有状況
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="保有数量">
          {summary.quantity.toLocaleString("ja-JP")}
          {unit}
        </Stat>
        <Stat label={isFund ? "平均取得単価（1万口あたり）" : "平均取得単価"}>
          {summary.avgCost === null ? "—" : formatPrice(summary.avgCost, currency)}
        </Stat>
        <Stat label="評価額">{formatCurrency(summary.marketValue, currency)}</Stat>
        <Stat label="含み損益">
          <span className={cn(pnlTone)}>
            {pnl === null ? "—" : `${pnl > 0 ? "+" : ""}${formatCurrency(pnl, currency)}`}
            {summary.unrealizedPnlPercent !== null ? (
              <span className="ml-1 text-sm font-semibold">({formatPercent(summary.unrealizedPnlPercent)})</span>
            ) : null}
          </span>
        </Stat>
      </dl>
      {summary.lots.some((lot) => lot.nisaType !== null || summary.lots.length > 1) ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
          {summary.lots.map((lot, index) => (
            <li key={index} className="rounded-button border border-border px-2 py-1">
              {lot.nisaType ? NISA_LABEL[lot.nisaType] : "課税口座"} {lot.quantity.toLocaleString("ja-JP")}
              {unit}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
