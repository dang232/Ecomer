import { ArrowUpRight } from "lucide-react";
import type { LayoutDashboard } from "lucide-react";

export interface KPICardProps {
  icon: typeof LayoutDashboard;
  label: string;
  value: string;
  change?: string;
  color: string;
  sub?: string;
}

export function KPICard({ icon: Icon, label, value, change, color, sub }: KPICardProps) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
        {change ? (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-500">
            <ArrowUpRight size={14} />
            {change}
          </div>
        ) : null}
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
    </div>
  );
}
