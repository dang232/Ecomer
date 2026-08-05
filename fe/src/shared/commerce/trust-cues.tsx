import { RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";

export interface TrustCue {
  id: "buyer-protection" | "returns" | "shipping";
  label: string;
  detail?: string;
}

const cueIcons: Record<TrustCue["id"], LucideIcon> = {
  "buyer-protection": ShieldCheck,
  returns: RotateCcw,
  shipping: Truck,
};

export interface TrustCuesProps {
  cues: readonly TrustCue[];
}

export function TrustCues({ cues }: TrustCuesProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3" aria-label="Purchase assurances">
      {cues.map((cue) => {
        const Icon = cueIcons[cue.id];
        return (
          <li
            key={cue.id}
            className="flex min-h-12 items-start gap-3 border-l-2 border-primary px-3 py-1"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{cue.label}</p>
              {cue.detail ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{cue.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
