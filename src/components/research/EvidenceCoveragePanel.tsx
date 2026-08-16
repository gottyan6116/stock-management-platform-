import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { calculateEvidenceCompleteness } from "@/features/research/sample-outlooks";
import type {
  EvidenceCategory,
  EvidenceStatus,
  ResearchDataKind,
  ResearchEvidence,
} from "@/features/research/types";

const categoryLabels: Record<EvidenceCategory, string> = {
  prices: "過去株価・チャート",
  financials: "決算・財務レポート",
  competitors: "競合・業界データ",
  orderBook: "板・需給の動き",
  statements: "投資家・経営者の発言",
  events: "M&A・重要発表",
};

const statusLabels: Record<EvidenceStatus, string> = {
  current: "更新済み",
  stale: "要更新",
  missing: "未接続",
};

const statusClasses: Record<EvidenceStatus, string> = {
  current: "bg-success-soft text-success-text",
  stale: "bg-warning-soft text-warning-text",
  missing: "bg-surface-subtle text-text-secondary",
};

export function EvidenceCoveragePanel({
  dataKind,
  evidence,
}: {
  dataKind: ResearchDataKind;
  evidence: readonly ResearchEvidence[];
}) {
  if (dataKind === "unavailable") {
    return (
      <AnalyticsPanel title="予測に使った情報">
        <p className="text-sm font-semibold text-text-primary">分析データがまだありません</p>
        <p className="mt-1 text-sm text-text-secondary">
          実データの接続後に、分析根拠と更新状況を表示します。
        </p>
      </AnalyticsPanel>
    );
  }

  const completeness = calculateEvidenceCompleteness(evidence);

  return (
    <AnalyticsPanel
      title="予測に使った情報"
      action={
        dataKind === "sample" ? (
          <span className="rounded-full bg-warning-soft px-2 py-1 text-xs font-bold text-warning-text">
            サンプル
          </span>
        ) : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-text-secondary">最新情報がそろっている割合</p>
        <p className="text-lg font-bold tabular-nums text-text-primary">{completeness}%</p>
      </div>

      {evidence.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">根拠情報は登録されていません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {evidence.map(({ category, status, detail }) => (
            <li key={category} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">
                  {categoryLabels[category]}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClasses[status]}`}
                >
                  {statusLabels[status]}
                </span>
              </div>
              {detail ? <p className="mt-2 text-xs text-text-secondary">{detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </AnalyticsPanel>
  );
}
