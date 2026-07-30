import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { IconButton } from "@/shared/ui";

export interface HorizontalRailProps {
  title: string;
  children: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
}

export function HorizontalRail({
  title,
  children,
  previousLabel = "Previous products",
  nextLabel = "Next products",
}: HorizontalRailProps) {
  const headingId = useId();
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.85, 160), behavior: "smooth" });
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-xl font-bold text-foreground">
          {title}
        </h2>
        <div className="hidden gap-1 md:flex">
          <IconButton label={previousLabel} onClick={() => scrollBy(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton label={nextLabel} onClick={() => scrollBy(1)}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div
        ref={railRef}
        className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:thin]"
      >
        {children}
      </div>
    </section>
  );
}
