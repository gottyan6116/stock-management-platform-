import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { toFreshnessInfo } from "@/lib/utils/freshness";
import { formatDateTime } from "@/lib/utils/format";

// Phase 7 で /api/sync/manual と sync_runs 履歴に置き換える。
const MOCK_SYNC_HISTORY = [
  { id: 1, triggerType: "cron", status: "success", finishedAt: new Date().toISOString(), successCount: 10, failureCount: 0 },
];

export default function SettingsPage() {
  const latest = MOCK_SYNC_HISTORY[0];
  const freshness = toFreshnessInfo({ priceDate: latest?.finishedAt?.slice(0, 10) ?? null, fetchedAt: latest?.finishedAt ?? null });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="設定" freshness={freshness} />

      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-text-primary">同期状況</p>
          <button
            type="button"
            disabled
            title="Phase 7で有効化されます"
            className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-muted"
          >
            今すぐ同期
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-text-muted">最終同期</p>
            <p className="font-semibold text-text-primary">{formatDateTime(latest?.finishedAt ?? null)}</p>
          </div>
          <div>
            <p className="text-text-muted">対象銘柄数</p>
            <p className="font-semibold text-text-primary">
              {(latest?.successCount ?? 0) + (latest?.failureCount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-text-muted">成功数</p>
            <p className="font-semibold text-success">{latest?.successCount ?? 0}</p>
          </div>
          <div>
            <p className="text-text-muted">失敗数</p>
            <p className="font-semibold text-danger">{latest?.failureCount ?? 0}</p>
          </div>
        </div>

        <p className="mt-6 mb-2 text-sm font-semibold text-text-primary">直近の同期履歴</p>
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          {MOCK_SYNC_HISTORY.map((run) => (
            <li key={run.id} className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
              <span>{run.triggerType === "cron" ? "自動同期" : "手動同期"}</span>
              <span>{formatDateTime(run.finishedAt)}</span>
              <span className="font-semibold text-success">成功 {run.successCount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
