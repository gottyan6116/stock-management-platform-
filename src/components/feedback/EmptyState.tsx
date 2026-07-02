import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface-subtle px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-text-muted" aria-hidden />
      <p className="text-base font-semibold text-text-primary">{title}</p>
      <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      {action}
    </div>
  );
}
