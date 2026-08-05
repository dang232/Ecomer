import { BadgeCheck, Store } from "lucide-react";

export interface SellerIdentityProps {
  name: string;
  verified?: boolean;
}

export function SellerIdentity({ name, verified = false }: SellerIdentityProps) {
  return (
    <span className="mt-1 inline-flex min-h-5 max-w-full items-center gap-1 text-xs text-muted-foreground">
      <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
      {verified ? (
        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-info" aria-label="Verified seller" />
      ) : null}
    </span>
  );
}
