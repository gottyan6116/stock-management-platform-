export function MarketRatioDonut({ jpCount, usCount }: { jpCount: number; usCount: number }) {
  const total = jpCount + usCount;
  const jpPercent = total > 0 ? (jpCount / total) * 100 : 0;

  const gradient =
    total > 0
      ? `conic-gradient(var(--primary-soft) 0% ${jpPercent}%, var(--primary) ${jpPercent}% 100%)`
      : "conic-gradient(var(--border) 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label={`日本株 ${jpCount}銘柄、米国株 ${usCount}銘柄`}
      >
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-2xl font-bold tabular-nums text-text-primary">{total}</span>
          <span className="text-xs text-text-muted">合計銘柄</span>
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-soft" aria-hidden />
          日本株 {jpCount}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          米国株 {usCount}
        </span>
      </div>
    </div>
  );
}
