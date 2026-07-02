import type { ChartInterval, ChartMode, ChartRange } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "1y", label: "1年" },
  { value: "3y", label: "3年" },
  { value: "5y", label: "5年" },
  { value: "10y", label: "10年" },
  { value: "max", label: "全期間" },
];

const INTERVAL_OPTIONS: { value: ChartInterval; label: string }[] = [
  { value: "week", label: "週足" },
  { value: "month", label: "月足" },
];

const MODE_OPTIONS: { value: ChartMode; label: string }[] = [
  { value: "candlestick", label: "ローソク足" },
  { value: "line", label: "ライン" },
];

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-button border border-border bg-surface-subtle p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors",
            value === opt.value
              ? "bg-surface text-primary shadow-card"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ChartToolbar({
  interval,
  onIntervalChange,
  range,
  onRangeChange,
  mode,
  onModeChange,
}: {
  interval: ChartInterval;
  onIntervalChange: (v: ChartInterval) => void;
  range: ChartRange;
  onRangeChange: (v: ChartRange) => void;
  mode: ChartMode;
  onModeChange: (v: ChartMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup options={INTERVAL_OPTIONS} value={interval} onChange={onIntervalChange} ariaLabel="足種切替" />
      <ToggleGroup options={MODE_OPTIONS} value={mode} onChange={onModeChange} ariaLabel="表示方式切替" />
      <ToggleGroup options={RANGE_OPTIONS} value={range} onChange={onRangeChange} ariaLabel="期間切替" />
    </div>
  );
}
