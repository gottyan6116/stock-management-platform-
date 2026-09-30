"use client";

import { useMemo, useState } from "react";
import { PurchaseDialog } from "@/components/portfolio/PurchaseDialog";
import { usePurchases } from "@/features/portfolio/purchases";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import { annualUsage, lifetimeBookValue, NISA_LIMITS } from "@/lib/portfolio/nisa";
import type { FxRate } from "@/lib/portfolio/valuation";
import { formatCurrency, todayJst } from "@/lib/utils/format";

function QuotaRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = Math.min(used / limit, 1);
  const over = used > limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text-primary">{label}</span>
        <span className="tabular-nums text-text-secondary">
          <span className="font-bold text-text-primary">{formatCurrency(used, "JPY")}</span>
          {" / "}
          {formatCurrency(limit, "JPY")}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}の使用率`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(used)}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
      >
        <div className="h-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-text-muted">
        {over ? `上限を ${formatCurrency(used - limit, "JPY")} 超えています` : `残り ${formatCurrency(limit - used, "JPY")}`}
      </p>
    </div>
  );
}

/**
 * NISA枠。年間投資枠は買付履歴（手入力）から、生涯投資枠は現在の保有の簿価から求める。
 * 買付が未記録の年は「0円使用」と誤読されないよう、消化額を出さずに記録を促す。
 */
export function NisaQuotaCard({
  positions,
  fx,
}: {
  positions: readonly EvaluatedPosition[];
  fx: FxRate | null;
}) {
  const year = Number(todayJst().slice(0, 4));
  const { data: purchases = [] } = usePurchases(year);
  const [open, setOpen] = useState(false);

  const nisaPositions = useMemo(() => positions.filter((p) => p.nisaType !== null), [positions]);
  const annual = useMemo(() => annualUsage(purchases, year), [purchases, year]);
  const lifetime = useMemo(() => lifetimeBookValue(positions, fx), [positions, fx]);

  if (nisaPositions.length === 0) return null;

  return (
    <section aria-labelledby="nisa-heading" className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="nisa-heading" className="text-sm font-bold text-text-primary">
          NISA枠
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center rounded-button border border-border px-3 text-sm font-semibold text-text-primary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          買付を記録
        </button>
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-text-muted">年間投資枠（{year}年・買付額）</h3>
          {annual.recordCount === 0 ? (
            <p className="text-sm leading-6 text-text-secondary">
              {year}年の買付が未記録のため、消化額は表示できません。「買付を記録」から約定金額を入力してください。
            </p>
          ) : (
            <>
              <QuotaRow label="つみたて投資枠" used={annual.tsumitate} limit={NISA_LIMITS.annualTsumitate} />
              <QuotaRow label="成長投資枠" used={annual.growth} limit={NISA_LIMITS.annualGrowth} />
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-text-muted">生涯投資枠（簿価ベース）</h3>
          <QuotaRow label="合計" used={lifetime.total} limit={NISA_LIMITS.lifetimeTotal} />
          <QuotaRow label="うち成長投資枠" used={lifetime.growth} limit={NISA_LIMITS.lifetimeGrowth} />
          {lifetime.unknownCount > 0 ? (
            <p className="text-xs text-text-muted">
              取得単価が未入力（または円換算できない）{lifetime.unknownCount}件は、簿価に含めていません。
            </p>
          ) : null}
        </div>
      </div>

      <PurchaseDialog open={open} onClose={() => setOpen(false)} year={year} positions={positions} purchases={purchases} />
    </section>
  );
}
