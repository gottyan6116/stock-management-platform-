import { Info } from "lucide-react";

export function MetricCard({
  label,
  icon,
  tooltip,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[13px] font-semibold text-text-secondary">
          {label}
          {tooltip ? (
            <span title={tooltip}>
              <Info className="h-3.5 w-3.5 text-text-muted" aria-hidden />
            </span>
          ) : null}
        </p>
        {icon}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function MetricValue({ children }: { children: React.ReactNode }) {
  return <p className="text-[26px] font-bold tabular-nums text-text-primary">{children}</p>;
}

export function MetricDelta({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-text-secondary">{children}</p>;
}
