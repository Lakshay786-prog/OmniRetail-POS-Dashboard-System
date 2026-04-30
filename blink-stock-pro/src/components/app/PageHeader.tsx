import { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.22em] text-accent font-medium mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}