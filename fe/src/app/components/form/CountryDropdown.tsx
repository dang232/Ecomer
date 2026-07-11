import type { CountryCode } from "libphonenumber-js";
import { ChevronDown, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  filterCountries,
  sortedCountriesForPicker,
  type CountryOption,
} from "../../lib/validation/countries";

export interface CountryDropdownProps {
  /** Active country; controls which option is highlighted. */
  value: CountryCode;
  /** Receives the new country when the user picks one. */
  onChange: (country: CountryCode) => void;
  /** Locale for the country list. */
  locale?: string;
  /** Disable the trigger and the popover. */
  disabled?: boolean;
  /** id of the trigger button (for aria-controls). */
  id?: string;
}

/**
 * Custom country dropdown for the phone-number input. Trigger is a button
 * showing the active flag, ISO code, and dial code; clicking it opens a
 * popover with a search box at the top and a keyboard-navigable list of
 * every supported country. Click-outside and Escape close the popover.
 *
 * Why not the native <select>? On desktop the native menu is monochrome
 * and unsearchable; on mobile the native picker is fine but loses the
 * search affordance. A custom popover gives us flag + name + dial code
 * in the trigger (so the user always sees what they picked), search to
 * jump to a country in 245 entries, and ↑/↓/Enter/Esc keyboard support.
 */
export function CountryDropdown({
  value,
  onChange,
  locale = "en",
  disabled,
  id,
}: CountryDropdownProps) {
  const autoId = useId();
  const triggerId = id ?? `country-trigger-${autoId}`;
  const listboxId = `country-listbox-${autoId}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  // Full list (memoized; the locale rarely changes).
  const allCountries: CountryOption[] = useMemo(
    () => sortedCountriesForPicker(locale),
    [locale],
  );

  // Filtered list based on the search query.
  const visible = useMemo(
    () => filterCountries(allCountries, query),
    [allCountries, query],
  );

  // Index of the active country in the *visible* list. Used to scroll the
  // popover to the active option when it opens.
  const activeIndexInVisible = useMemo(
    () => visible.findIndex((c) => c.code === value),
    [visible, value],
  );

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Find the active country in the full list to render the trigger.
  const active = useMemo(
    () => allCountries.find((c) => c.code === value) ?? allCountries[0],
    [allCountries, value],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback(
    (country: CountryCode) => {
      onChange(country);
      close();
    },
    [onChange, close],
  );

  // Click outside / Escape closes the popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // When the popover opens, focus the search box and scroll to the active
  // country.
  useEffect(() => {
    if (!open) return;
    // Defer one frame so the popover has been rendered.
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      const idx = activeIndexInVisible >= 0 ? activeIndexInVisible : 0;
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-idx="${idx}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
      setHighlight(idx);
    });
  }, [open, activeIndexInVisible]);

  const handleTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(visible.length - 1, h + 1));
      scrollHighlightIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      scrollHighlightIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = visible[highlight];
      if (target) select(target.code);
    } else if (e.key === "Tab") {
      // Let Tab close the popover naturally and move focus.
      close();
    }
  };

  const scrollHighlightIntoView = () => {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-idx="${highlight}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label="Country code"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        className="flex items-center gap-1.5 px-3 text-sm font-medium text-foreground outline-none cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 rounded-l-[var(--radius-lg)] transition-colors"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {active.flag}
        </span>
        <span className="text-muted-foreground text-xs">{active.dialCode}</span>
        <ChevronDown
          aria-hidden="true"
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Select country"
          className="absolute z-50 left-0 mt-2 w-72 max-h-80 bg-card border border-border rounded-[var(--radius-lg)] shadow-lg overflow-hidden flex flex-col"
        >
          {/* Search box */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-muted-foreground flex-shrink-0"
            />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-expanded={open}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleSearchKey}
              placeholder="Search country…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Country list */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Countries"
            className="flex-1 overflow-y-auto"
          >
            {visible.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No countries match "{query}"
              </li>
            ) : (
              visible.map((c, idx) => {
                const isActive = c.code === value;
                const isHighlighted = idx === highlight;
                return (
                  <li
                    key={c.code}
                    data-idx={idx}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => select(c.code)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                      isHighlighted ? "bg-muted" : ""
                    } ${isActive ? "font-semibold text-foreground" : "text-foreground"}`}
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {c.flag}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.dialCode}
                    </span>
                    {c.isPrimary ? (
                      <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                        Primary
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
