import { LucideIcon } from "lucide-react";

export function StatCard({ label, value, delta, icon: Icon, accent }: { label: string; value: string; delta?: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 transition-smooth hover:-translate-y-0.5 ${accent ? "bg-gradient-primary text-primary-foreground border-transparent shadow-elegant" : "bg-card border-border"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-[11px] uppercase tracking-[0.18em] ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</div>
          <div className="font-display text-3xl font-semibold mt-2 font-mono-num">{value}</div>
          {delta && <div className={`text-xs mt-1.5 ${accent ? "text-primary-foreground/80" : "text-success"}`}>{delta}</div>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary-foreground/15" : "bg-secondary"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}