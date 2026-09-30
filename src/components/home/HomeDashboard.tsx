"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { AssetHistoryChart } from "@/components/charts/AssetHistoryChart";
import { NisaQuotaCard } from "@/components/home/NisaQuotaCard";
import { Skeleton } from "@/components/feedback/Skeleton";
import { FundNavDialog } from "@/components/portfolio/FundNavDialog";
import { SignedAmount } from "@/components/ui/SignedAmount";
import { getNavLabel } from "@/config/navigation";
import { fetchPositions, POSITIONS_KEY } from "@/features/portfolio/api";
import { useUsdJpy } from "@/features/portfolio/fx";
import { recordTodaySnapshot, SNAPSHOTS_KEY, useSnapshots } from "@/features/portfolio/snapshots";
import { evaluatePositions } from "@/features/portfolio/summary";
import {
  allocate,
  listStaleFundIds,
  summarizePortfolioJpy,
  type AllocationDimension,
} from "@/lib/portfolio/valuation";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatPrice, todayJst } from "@/lib/utils/format";

const SEGMENT_COLORS = ["var(--primary)", "var(--series-mint)", "var(--border-strong)"];

const DIMENSIONS: { value: AllocationDimension; label: string }[] = [
  { value: "account", label: "口座" },
  { value: "assetClass", label: "資産クラス" },
];

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="ホームを読み込み中">
      <Skeleton className="h-32 w-full rounded-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{children}</p>
    </div>
  );
}

export function HomeDashboard() {
  const { data = [], isLoading, isError } = useQuery({ queryKey: POSITIONS_KEY, queryFn: fetchPositions });
  const { data: fx = null, isFetched: fxFetched } = useUsdJpy();
  const { data: snapshots, isFetched: snapshotsFetched } = useSnapshots();
  const queryClient = useQueryClient();
  const recordedRef = useRef(false);
  const [dimension, setDimension] = useState<AllocationDimension>("account");
  const [navOpen, setNavOpen] = useState(false);

  const evaluated = useMemo(() => evaluatePositions(data), [data]);
  const summary = useMemo(() => summarizePortfolioJpy(evaluated, fx), [evaluated, fx]);
  const slices = useMemo(() => allocate(evaluated, fx, dimension), [evaluated, fx, dimension]);
  const staleFundIds = useMemo(() => listStaleFundIds(evaluated, todayJst()), [evaluated]);

  // 今日の分がまだ無ければ一度だけ記録する（金額はサーバーが計算。cronの実行を待たずに履歴を始める）。
  const today = todayJst();
  const hasToday = snapshots?.some((p) => p.date === today) ?? false;
  const canRecord = summary.totalValueJpy !== null && summary.excludedCount === 0;
  useEffect(() => {
    if (recordedRef.current || !snapshotsFetched || !fxFetched || hasToday || !canRecord) return;
    recordedRef.current = true;
    recordTodaySnapshot()
      .then(() => queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY }))
      .catch(() => undefined);
  }, [snapshotsFetched, fxFetched, hasToday, canRecord, queryClient]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={getNavLabel("/home")} />
        <HomeSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={getNavLabel("/home")} />
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-card border border-danger bg-danger-soft px-6 text-center">
          <AlertTriangle className="h-7 w-7 text-danger" aria-hidden />
          <p className="text-lg font-bold text-text-primary">資産情報を読み込めませんでした</p>
          <p className="max-w-md text-sm text-text-secondary">
            通信状態を確認してから再読み込みしてください。登録済みデータは変更されていません。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-button bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (evaluated.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={getNavLabel("/home")} />
        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-card border border-border bg-surface px-6 text-center">
          <Briefcase className="h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-4 text-lg font-bold text-text-primary">保有資産を登録しましょう</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
            保有を登録すると、総資産と含み損益が円換算で表示されます。
          </p>
          <Link
            href="/portfolio"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-button bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover"
          >
            保有資産を登録する
          </Link>
        </section>
      </div>
    );
  }

  const usdNote = fx
    ? `USD保有 ${formatCurrency(summary.usdValue, "USD")} を 1ドル=${formatPrice(fx.usdJpy, "JPY").replace("¥", "")}円で換算`
    : summary.usdValue > 0
      ? `為替レートを取得できないため、USD保有 ${formatCurrency(summary.usdValue, "USD")} は合計に含めていません`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={getNavLabel("/home")} />

      <section aria-labelledby="total-assets-heading" className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-10">
            <div>
              <h2 id="total-assets-heading" className="text-xs text-text-muted">
                総資産（円換算）
              </h2>
              <p className="mt-1 text-4xl font-bold tabular-nums text-text-primary">
                {formatCurrency(summary.totalValueJpy, "JPY")}
              </p>
            </div>
            <Stat label="含み損益">
              <SignedAmount value={summary.unrealizedPnlJpy} currency="JPY" percent={summary.unrealizedPnlPercent} />
            </Stat>
            <Stat label="前日比">
              <SignedAmount value={summary.dayChangeJpy} currency="JPY" percent={summary.dayChangePercent} />
            </Stat>
          </div>
          <div className="text-xs leading-5 text-text-muted lg:text-right">
            {usdNote ? <p>{usdNote}</p> : null}
            {summary.dayChangeJpy !== null ? <p>前日比は株式のみ（投資信託は基準価額を手入力のため含みません）</p> : null}
            {summary.excludedCount > 0 && fx ? <p>価格を取得できない{summary.excludedCount}件は合計に含めていません</p> : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="history-heading" className="rounded-card border border-border bg-surface p-5">
        <h2 id="history-heading" className="text-sm font-bold text-text-primary">
          資産推移（円換算）
        </h2>
        <AssetHistoryChart points={snapshots ?? []} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="allocation-heading" className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="allocation-heading" className="text-sm font-bold text-text-primary">
              資産配分（評価額ベース）
            </h2>
            <div role="group" aria-label="配分の切り替え" className="inline-flex rounded-button border border-border p-0.5">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={dimension === d.value}
                  onClick={() => setDimension(d.value)}
                  className={cn(
                    "min-h-9 rounded-sm px-3 text-xs font-semibold",
                    dimension === d.value ? "bg-text-primary text-white" : "text-text-secondary hover:bg-surface-subtle"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {slices.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">評価額を計算できる保有がありません。</p>
          ) : (
            <>
              <div
                className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-subtle"
                role="img"
                aria-label={slices.map((s) => `${s.label} ${(s.share * 100).toFixed(1)}%`).join("、")}
              >
                {slices.map((slice, index) => (
                  <span
                    key={slice.key}
                    style={{ width: `${slice.share * 100}%`, background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                  />
                ))}
              </div>
              <ul className="mt-4 divide-y divide-border">
                {slices.map((slice, index) => (
                  <li key={slice.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-text-primary">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                      />
                      <span className="truncate">{slice.label}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-4 tabular-nums">
                      <span className="text-text-secondary">{formatCurrency(slice.valueJpy, "JPY")}</span>
                      <span className="w-14 text-right font-bold text-text-primary">
                        {(slice.share * 100).toFixed(1)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="actions-heading" className="rounded-card border border-border bg-surface p-5">
          <h2 id="actions-heading" className="text-sm font-bold text-text-primary">
            要対応
          </h2>
          {staleFundIds.length > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
              <span className="text-text-primary">投資信託の基準価額が未更新（{staleFundIds.length}本）</span>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                更新 →
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">対応事項はありません</p>
          )}
        </section>
      </div>

      <NisaQuotaCard positions={evaluated} fx={fx} />

      <FundNavDialog open={navOpen} onClose={() => setNavOpen(false)} positions={evaluated} staleFundIds={staleFundIds} />
    </div>
  );
}
