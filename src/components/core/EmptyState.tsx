import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="px-6 py-16 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted/40" />
      <p className="mt-3 text-muted">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-muted/60">{subtitle}</p>}
    </div>
  );
}