import { ArrowRight } from "lucide-react";

import { ImageWithFallback } from "@/shared/ui";

export interface CampaignMediaProps {
  title: string;
  imageUrl?: string;
  imageAlt: string;
  href: string;
  eyebrow?: string;
  description?: string;
  actionLabel?: string;
}

export function CampaignMedia({
  title,
  imageUrl,
  imageAlt,
  href,
  eyebrow,
  description,
  actionLabel = "Shop collection",
}: CampaignMediaProps) {
  return (
    <a
      href={href}
      className="group grid overflow-hidden border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-2"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted sm:order-2 sm:aspect-auto">
        <ImageWithFallback
          src={imageUrl ?? ""}
          alt={imageAlt}
          className="h-full w-full object-cover transition-transform duration-[var(--duration-base)] motion-reduce:transform-none group-hover:scale-105"
        />
      </div>
      <div className="flex min-h-52 flex-col justify-center p-6">
        {eyebrow ? <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p> : null}
        <h3 className="mt-2 text-xl font-bold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          {actionLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transform-none group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </a>
  );
}
