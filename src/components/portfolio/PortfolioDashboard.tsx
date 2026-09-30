"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { SignedAmount } from "@/components/ui/SignedAmount";
import { getNavLabel } from "@/config/navigation";
import { fetchPositions, POSITIONS_KEY } from "@/features/portfolio/api";
import { useUsdJpy } from "@/features/portfolio/fx";
import { evaluatePositions } from "@/features/portfolio/summary";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import {
  ACCOUNT_LABEL,
  ACCOUNT_ORDER,
  accountKeyOf,
  listStaleFundIds,
  summarizePortfolioJpy,
  type AccountKey,
} from "@/lib/portfolio/valuation";
import { formatCurrency, todayJst } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { AddPositionDialog } from "./AddPositionDialog";
import { DeletePositionDialog } from "./DeletePositionDialog";
import { EditPositionDialog } from "./EditPositionDialog";
import { FundNavDialog } from "./FundNavDialog";
import { HoldingsGroups } from "./HoldingsGroups";

type AccountFilter = "all" | AccountKey;

export function PortfolioDashboard() {
  const { data, isLoading } = useQuery({ queryKey: POSITIONS_KEY, queryFn: fetchPositions });
  const { data: fx = null } = useUsdJpy();
  const positions = useMemo(() => data ?? [], [data]);

  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluatedPosition | null>(null);
  const [deleting, setDeleting] = useState<EvaluatedPosition | null>(null);

  const evaluated = useMemo(() => evaluatePositions(positions), [positions]);
  const overall = useMemo(() => summarizePortfolioJpy(evaluated, fx), [evaluated, fx]);
  const staleFundIds = useMemo(() => listStaleFundIds(evaluated, todayJst()), [evaluated]);

  // 実際に保有がある口座だけをチップに出す。
  const presentAccounts = useMemo(
    () => ACCOUNT_ORDER.filter((key) => evaluated.some((p) => accountKeyOf(p.nisaType) === key)),
    [evaluated]
  );
  const rows = useMemo(
    () => (accountFilter === "all" ? evaluated : evaluated.filter((p) => accountKeyOf(p.nisaType) === accountFilter)),
    [evaluated, accountFilter]
  );

  const hasFunds = evaluated.some((p) => p.assetClass === "fund");
  const usdExcluded = !fx && evaluated.some((p) => p.currency === "USD" && p.marketValue !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={getNavLabel("/portfolio")}
        description={
          evaluated.length === 0 ? undefined : (
            <span className="tabular-nums">
              {evaluated.length}件・評価額 {formatCurrency(overall.totalValueJpy, "JPY")}・含み損益{" "}
              <SignedAmount value={overall.unrealizedPnlJpy} currency="JPY" className="font-semibold" />
            </span>
          )
        }
        actions={
          <>
            {hasFunds ? (
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="inline-flex min-h-11 items-center rounded-button border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                基準価額を更新
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex min-h-11 items-center rounded-button bg-text-primary px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              ＋ 保有を追加
            </button>
          </>
        }
      />

      {presentAccounts.length > 1 ? (
        <div role="group" aria-label="口座で絞り込み" className="flex flex-wrap gap-2">
          {(["all", ...presentAccounts] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={accountFilter === key}
              onClick={() => setAccountFilter(key)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                accountFilter === key
                  ? "border-text-primary bg-text-primary text-white"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-subtle"
              )}
            >
              {key === "all" ? "すべての口座" : ACCOUNT_LABEL[key]}
            </button>
          ))}
        </div>
      ) : null}

      {usdExcluded ? (
        <p role="status" className="rounded-button border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          為替レートを取得できなかったため、USD建ての保有は円換算の合計・構成比に含めていません。
        </p>
      ) : null}

      {isLoading ? null : rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="保有銘柄がまだ登録されていません"
          description="「＋ 保有を追加」から銘柄コード・保有数量を入力して追加してください"
        />
      ) : (
        <HoldingsGroups rows={rows} fx={fx} onEdit={setEditing} onDelete={setDeleting} />
      )}

      <AddPositionDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditPositionDialog position={editing} onClose={() => setEditing(null)} />
      <DeletePositionDialog position={deleting} onClose={() => setDeleting(null)} />
      <FundNavDialog
        open={navOpen}
        onClose={() => setNavOpen(false)}
        positions={evaluated}
        staleFundIds={staleFundIds}
      />
    </div>
  );
}
