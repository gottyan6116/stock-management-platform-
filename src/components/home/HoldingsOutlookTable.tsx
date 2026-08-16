import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import { getResearchOutlook } from "@/features/research/sample-outlooks";
import type {
  HorizonScore,
  OutlookAction,
  OutlookHorizon,
  ResearchOutlook,
} from "@/features/research/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils/format";

export type DashboardHorizon = OutlookHorizon | "5y";

const actionLabels: Record<OutlookAction, string> = {
  hold: "保有継続",
  watch: "様子を見る",
  review: "見直す",
};

const actionClasses: Record<OutlookAction, string> = {
  hold: "bg-success-soft text-success-text",
  watch: "bg-warning-soft text-warning-text",
  review: "bg-danger-soft text-danger-text",
};

function getOutlook(
  position: EvaluatedPosition,
  horizon: DashboardHorizon
): ResearchOutlook | null {
  if (horizon === "5y") return null;
  return getResearchOutlook(position.providerSymbol);
}

function OutlookProvenance({ outlook }: { outlook: ResearchOutlook }) {
  return (
    <p className="mt-1 text-[11px] leading-4 text-text-muted">
      {outlook.sampleLabel} · {outlook.source} · {outlook.modelVersion} ·{" "}
      {outlook.updatedAt ? `更新 ${formatDateTime(outlook.updatedAt)}` : "更新時刻なし"}
    </p>
  );
}

function SignedPnl({ position }: { position: EvaluatedPosition }) {
  if (position.unrealizedPnl === null) return <span className="text-text-muted">—</span>;
  const tone =
    position.unrealizedPnl > 0
      ? "text-success-text"
      : position.unrealizedPnl < 0
        ? "text-danger-text"
        : "text-text-primary";
  return (
    <span className={cn("font-semibold tabular-nums", tone)}>
      <span>{position.unrealizedPnl > 0 ? "+" : ""}</span>
      <span>{formatCurrency(position.unrealizedPnl, position.currency)}</span>
      {position.unrealizedPnlPercent === null ? null : (
        <span className="ml-1 text-xs">({formatPercent(position.unrealizedPnlPercent)})</span>
      )}
    </span>
  );
}

function OutlookTableCells({ score }: { score: HorizonScore | null }) {
  if (!score) {
    return (
      <>
        <td className="px-4 py-3 text-text-muted">未提供</td>
        <td className="px-4 py-3 text-text-muted">未提供</td>
        <td className="px-4 py-3 text-text-muted">未提供</td>
      </>
    );
  }
  return (
    <>
      <td className="px-4 py-3 font-semibold tabular-nums text-text-primary">
        {score.positiveProbability}%
      </td>
      <td className="px-4 py-3 font-semibold tabular-nums text-text-primary">
        {score.evidenceStrength}%
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-bold",
            actionClasses[score.action]
          )}
        >
          {actionLabels[score.action]}
        </span>
      </td>
    </>
  );
}

export function HoldingsOutlookTable({
  positions,
  sampleEnabled,
  horizon,
}: {
  positions: EvaluatedPosition[];
  sampleEnabled: boolean;
  horizon: DashboardHorizon;
}) {
  return (
    <section
      aria-labelledby="holdings-outlook-heading"
      className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      <div className="flex min-h-11 items-center justify-between gap-4 border-b border-border px-4">
        <div>
          <h2 id="holdings-outlook-heading" className="text-sm font-bold text-text-primary">
            保有銘柄の見通し
          </h2>
          <p className="text-xs text-text-muted">
            {horizon === "5y"
              ? "5年の見通しは未提供"
              : `${horizon === "3y" ? "3年" : "1年"}の判断材料`}
          </p>
        </div>
        {sampleEnabled && horizon !== "5y" ? (
          <span className="rounded-full bg-warning-soft px-2 py-1 text-xs font-bold text-warning-text">
            サンプル
          </span>
        ) : null}
      </div>

      {!sampleEnabled ? (
        <div className="border-b border-border bg-surface-subtle px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">保有銘柄の分析は未接続です</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            評価額と含み損益は実データを表示し、見通しは分析接続後に追加します。
          </p>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-subtle text-left text-xs font-semibold text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                銘柄
              </th>
              <th scope="col" className="px-4 py-2.5">
                評価額
              </th>
              <th scope="col" className="px-4 py-2.5">
                含み損益
              </th>
              <th scope="col" className="px-4 py-2.5">
                プラスの可能性
              </th>
              <th scope="col" className="px-4 py-2.5">
                根拠の強さ
              </th>
              <th scope="col" className="px-4 py-2.5">
                判断
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">詳細</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const outlook = sampleEnabled ? getOutlook(position, horizon) : null;
              const score = outlook && horizon !== "5y" ? outlook.horizonScores[horizon] : null;
              return (
                <tr key={position.id} className="border-t border-border hover:bg-surface-subtle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{position.name}</p>
                    <p className="text-xs text-text-muted">
                      {position.displaySymbol} · {position.currency}
                    </p>
                    {outlook ? <OutlookProvenance outlook={outlook} /> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-text-primary">
                    {formatCurrency(position.marketValue, position.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <SignedPnl position={position} />
                  </td>
                  {sampleEnabled ? (
                    <OutlookTableCells score={score} />
                  ) : (
                    <>
                      <td className="px-4 py-3 text-text-muted">—</td>
                      <td className="px-4 py-3 text-text-muted">—</td>
                      <td className="px-4 py-3 text-text-muted">分析待ち</td>
                    </>
                  )}
                  <td className="px-4 py-2">
                    <Link
                      href={`/stocks/${encodeURIComponent(position.providerSymbol)}`}
                      className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-button px-2 text-xs font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:bg-primary-soft"
                    >
                      詳細
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {positions.map((position) => {
          const outlook = sampleEnabled ? getOutlook(position, horizon) : null;
          const score = outlook && horizon !== "5y" ? outlook.horizonScores[horizon] : null;
          return (
            <li key={position.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{position.name}</p>
                  <p className="text-xs text-text-muted">
                    {position.displaySymbol} · {position.currency}
                  </p>
                  {outlook ? <OutlookProvenance outlook={outlook} /> : null}
                </div>
                {sampleEnabled && score ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-1 text-xs font-bold",
                      actionClasses[score.action]
                    )}
                  >
                    {actionLabels[score.action]}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-text-muted">
                    {sampleEnabled ? "未提供" : "分析待ち"}
                  </span>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">評価額</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-text-primary">
                    {formatCurrency(position.marketValue, position.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">含み損益</dt>
                  <dd className="mt-0.5">
                    <SignedPnl position={position} />
                  </dd>
                </div>
                {sampleEnabled ? (
                  <>
                    <div>
                      <dt className="text-xs text-text-muted">プラスの可能性</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-text-primary">
                        {score ? `${score.positiveProbability}%` : "未提供"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">根拠の強さ</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-text-primary">
                        {score ? `${score.evidenceStrength}%` : "未提供"}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>

              <Link
                href={`/stocks/${encodeURIComponent(position.providerSymbol)}`}
                className="mt-2 inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-button text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:text-primary-hover"
              >
                銘柄の詳細を見る
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
