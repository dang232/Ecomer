import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "../lib/cn";

export interface TabItem<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<TValue extends string> {
  ariaLabel: string;
  value: TValue;
  items: readonly TabItem<TValue>[];
  onValueChange: (value: TValue) => void;
  className?: string;
}

export function Tabs<TValue extends string>({
  ariaLabel,
  value,
  items,
  onValueChange,
  className,
}: TabsProps<TValue>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);
    const current = enabled.findIndex(({ itemIndex }) => itemIndex === index);
    if (current < 0) return;

    let target = current;
    if (event.key === "ArrowRight") target = (current + 1) % enabled.length;
    else if (event.key === "ArrowLeft") target = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = enabled.length - 1;
    else return;

    event.preventDefault();
    const next = enabled[target];
    const tabs =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next.itemIndex]?.focus();
    onValueChange(next.item.value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex min-w-0 gap-1 overflow-x-auto border-b border-border", className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-[var(--target-web)] shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
