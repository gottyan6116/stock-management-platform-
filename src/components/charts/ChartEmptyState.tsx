export function ChartEmptyState() {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-semibold text-text-primary">この期間の価格データがありません</p>
      <p className="text-xs text-text-secondary">期間を短くするか、後でもう一度お試しください</p>
    </div>
  );
}
