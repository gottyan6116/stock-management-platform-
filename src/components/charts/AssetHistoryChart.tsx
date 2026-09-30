import type { SnapshotPoint } from "@/features/portfolio/snapshots";
import { formatCurrency } from "@/lib/utils/format";

const W = 640;
const H = 180;
const PAD_X = 8;
const PAD_Y = 14;

/**
 * 総資産の推移（円）。実測の区間は実線、推計で埋めた区間は破線で描き分ける。
 * 1日分しか無い間は、線を描かず「記録は今日から始まった」ことを説明する。
 */
export function AssetHistoryChart({ points }: { points: readonly SnapshotPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {points.length === 0
          ? "まだ記録がありません。ホームを開くと今日の分が記録され、以後は毎日自動で記録されます。"
          : `${points[0]!.date} から記録を始めました（${formatCurrency(points[0]!.totalValueJpy, "JPY")}）。日数がたまると推移グラフになります。`}
      </p>
    );
  }

  const values = points.map((p) => p.totalValueJpy);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_Y - ((v - min) / span) * (H - PAD_Y * 2);

  const segments = points.slice(1).map((point, i) => {
    const prev = points[i]!;
    return {
      key: point.date,
      d: `M${x(i).toFixed(1)},${y(prev.totalValueJpy).toFixed(1)} L${x(i + 1).toFixed(1)},${y(point.totalValueJpy).toFixed(1)}`,
      estimated: prev.isEstimated || point.isEstimated,
    };
  });
  const hasEstimated = segments.some((s) => s.estimated);
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`総資産の推移。${first.date}の${formatCurrency(first.totalValueJpy, "JPY")}から${last.date}の${formatCurrency(last.totalValueJpy, "JPY")}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
      >
        {segments.map((s) => (
          <path
            key={s.key}
            d={s.d}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray={s.estimated ? "5 4" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-text-muted">
        <span>{first.date}</span>
        <span>
          最小 {formatCurrency(min, "JPY")}・最大 {formatCurrency(max, "JPY")}
        </span>
        <span>{last.date}</span>
      </div>
      {hasEstimated ? <p className="mt-1 text-xs text-text-muted">破線は実測ではなく推計の期間です。</p> : null}
    </div>
  );
}
