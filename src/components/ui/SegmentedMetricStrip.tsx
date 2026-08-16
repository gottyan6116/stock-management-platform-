import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type MetricTone = "positive" | "negative" | "warning" | "neutral";

const valueToneClasses: Record<MetricTone, string> = {
  positive: "text-success-text",
  negative: "text-danger-text",
  warning: "text-warning-text",
  neutral: "text-text-primary",
};

export function SegmentedMetricStrip({
  ariaLabel,
  className,
  children,
}: {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "grid overflow-hidden rounded-card border border-border bg-surface-subtle divide-y divide-border sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0",
        className
      )}
    >
      {children}
    </ul>
  );
}

export function SegmentedMetric({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <li className={cn("min-w-0 px-4 py-3", className)}>
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <p className={cn("mt-1 truncate text-lg font-bold tabular-nums", valueToneClasses[tone])}>
        {value}
      </p>
    </li>
  );
}
