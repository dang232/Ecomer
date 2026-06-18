interface FacetEntry {
  key: string;
  count: number;
}

interface FacetListProps {
  title: string;
  entries: FacetEntry[];
  selected: string;
  /** Toggle handler — passing the same key that's currently selected unselects. */
  onToggle: (key: string) => void;
  /** Cap the visible entries (the BE returns counts sorted desc; truncation drops the long tail). */
  maxVisible?: number;
  /** Map a facet key to its display label. Defaults to identity (used for free-text axes like brand). */
  formatLabel?: (key: string) => string;
}

/**
 * Generic checkbox-style facet sidebar block. Used for both brand and
 * category axes on the search page; the parent owns selection state and the
 * key→label mapping. Rendering is deliberately minimal — no API knowledge
 * here, so future facet axes (size, color, ...) can drop in.
 */
export function FacetList({
  title,
  entries,
  selected,
  onToggle,
  maxVisible = 15,
  formatLabel = (key) => key,
}: FacetListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-5 pt-5 border-t border-border">
      <p className="text-sm font-semibold text-foreground mb-2">{title}</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.slice(0, maxVisible).map((entry) => {
          const isSelected = selected === entry.key;
          return (
            <button
              key={entry.key}
              onClick={() => onToggle(entry.key)}
              className="w-full flex items-center justify-between text-sm py-1"
              style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              <span className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    background: isSelected ? "var(--primary)" : "transparent",
                  }}
                >
                  {isSelected ? <span className="text-white text-[10px] font-bold">✓</span> : null}
                </div>
                <span className="truncate">{formatLabel(entry.key)}</span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">{entry.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
