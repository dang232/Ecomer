import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "../lib/cn";

export interface SegmentedControlItem<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<TValue extends string> {
  ariaLabel: string;
  value: TValue;
  items: readonly SegmentedControlItem<TValue>[];
  onValueChange: (value: TValue) => void;
  className?: string;
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  value,
  items,
  onValueChange,
  className,
}: SegmentedControlProps<TValue>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const enabled = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);
    const current = enabled.findIndex(({ itemIndex }) => itemIndex === index);
    if (current < 0) return;

    let target = current;
    if (event.key === "ArrowRight") target = (current + 1) % enabled.length;
    if (event.key === "ArrowLeft") target = (current - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = enabled.length - 1;

    event.preventDefault();
    const next = enabled[target];
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next.itemIndex]?.focus();
    onValueChange(next.item.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-[var(--target-web)] max-w-full rounded-[var(--radius-control)] bg-muted p-1",
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-9 min-w-0 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-card text-foreground shadow-[var(--shadow-low)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
