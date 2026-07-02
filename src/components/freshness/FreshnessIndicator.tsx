import type { FreshnessInfo } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const STATUS_LABEL: Record<FreshnessInfo["status"], string> = {
  ok: "正常",
  stale: "24時間以上古い",
  failed: "同期失敗",
  unknown: "未取得",
};

const STATUS_DOT_CLASS: Record<FreshnessInfo["status"], string> = {
  ok: "bg-success",
  stale: "bg-warning",
  failed: "bg-danger",
  unknown: "bg-text-muted",
};

export function FreshnessIndicator({ info }: { info: FreshnessInfo }) {
  return (
    <div
      className="flex flex-col items-end gap-0.5 text-xs text-text-secondary"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 font-semibold text-text-primary">
        <span
          aria-hidden
          className={cn("inline-block h-2 w-2 rounded-full", STATUS_DOT_CLASS[info.status])}
        />
        {STATUS_LABEL[info.status]}
      </span>
      <span>価格基準日 {formatDate(info.priceDate)}</span>
      <span>取得 {formatDateTime(info.fetchedAt)}</span>
    </div>
  );
}
