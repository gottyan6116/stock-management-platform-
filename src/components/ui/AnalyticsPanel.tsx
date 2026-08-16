import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function AnalyticsPanelHeader({
  title,
  action,
  titleId,
}: {
  title: string;
  action?: ReactNode;
  titleId?: string;
}) {
  const generatedTitleId = useId();

  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border px-4">
      <h2 id={titleId ?? generatedTitleId} className="text-sm font-bold text-text-primary">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function AnalyticsPanel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className={cn("rounded-card border border-border bg-surface shadow-card", className)}
    >
      <AnalyticsPanelHeader title={title} action={action} titleId={titleId} />
      <div className="p-4">{children}</div>
    </section>
  );
}
