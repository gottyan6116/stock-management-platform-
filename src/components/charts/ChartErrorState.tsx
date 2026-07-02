import { formatDateTime } from "@/lib/utils/format";

export function ChartErrorState({ lastSuccessfulFetchAt }: { lastSuccessfulFetchAt: string | null }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-semibold text-text-primary">最新データを取得できませんでした</p>
      <p className="text-xs text-text-secondary">前回取得したデータを表示しています</p>
      <p className="text-xs text-text-muted">最終正常取得: {formatDateTime(lastSuccessfulFetchAt)}</p>
      <button
        type="button"
        className="mt-2 rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
      >
        再試行
      </button>
    </div>
  );
}
