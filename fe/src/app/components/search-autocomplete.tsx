import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface SearchAutocompleteProps {
  value: string;
  suggestions: string[];
  onValueChange: (next: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Generic autocomplete input. The data source (search suggestions, recent
 * queries, popular tags, ...) is the parent's responsibility — this component
 * only renders the input + dropdown and dispatches submissions. Keeps the UI
 * reusable across surfaces that have different suggestion sources.
 */
export function SearchAutocomplete({
  value,
  suggestions,
  onValueChange,
  onSubmit,
  placeholder = "Search for products, brands, and categories...",
  className,
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Reset highlight whenever the suggestion list shape changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const submit = (q: string) => {
    if (!q.trim()) return;
    onSubmit(q.trim());
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0 || !open) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit(value);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(activeIndex >= 0 ? suggestions[activeIndex] : value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none transition-colors" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-2.5 pl-10 pr-4 border-[1.5px] border-border rounded-[var(--radius-xl)] text-sm bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_var(--primary-light)] focus:bg-card transition-all duration-[var(--duration-base)]"
          aria-label="Search products"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
        />
      </form>

      {showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto bg-card rounded-[var(--radius-lg)] shadow-lg border border-border z-50 p-2 animate-fade-in"
        >
          {suggestions.map((suggestion, idx) => (
            <li
              key={suggestion}
              id={`${listboxId}-option-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 rounded-[var(--radius-md)] ${
                  idx === activeIndex
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } transition-colors`}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{suggestion}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
