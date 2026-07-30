import { useEffect, useState } from "react";

export interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive";
}

export function LiveRegion({ message, politeness = "polite" }: LiveRegionProps) {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    if (!message) return;
    setAnnounced("");
    const timer = setTimeout(() => setAnnounced(message), 100);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {announced}
    </div>
  );
}
