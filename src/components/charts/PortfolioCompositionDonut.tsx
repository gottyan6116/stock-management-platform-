export function PortfolioCompositionDonut({
  stockCount,
  fundCount,
  otherCount,
}: {
  stockCount: number;
  fundCount: number;
  otherCount: number;
}) {
  const total = stockCount + fundCount + otherCount;
  const stockEnd = total > 0 ? (stockCount / total) * 100 : 0;
  const fundEnd = total > 0 ? stockEnd + (fundCount / total) * 100 : 0;
  const gradient =
    total > 0
      ? `conic-gradient(var(--primary) 0% ${stockEnd}%, var(--series-mint) ${stockEnd}% ${fundEnd}%, var(--series-yellow) ${fundEnd}% 100%)`
      : "conic-gradient(var(--border) 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label={`株式 ${stockCount}件、投資信託 ${fundCount}件、ETF・指数 ${otherCount}件`}
      >
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-2xl font-bold tabular-nums text-text-primary">{total}</span>
          <span className="text-xs text-text-secondary">合計保有件数</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          株式 {stockCount}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-series-mint" aria-hidden />
          投資信託 {fundCount}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-series-yellow" aria-hidden />
          ETF・指数 {otherCount}
        </span>
      </div>
      <p className="max-w-xs text-center text-xs leading-5 text-text-muted">
        評価額や通貨を合算せず、保有件数で表示しています。
      </p>
    </div>
  );
}
