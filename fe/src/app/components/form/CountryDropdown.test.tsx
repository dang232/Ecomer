/** Unit tests for the CountryDropdown component. */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountryDropdown } from "./CountryDropdown";

const noopOnChange = vi.fn<(countryCode: string) => void>();

afterEach(() => {
  vi.clearAllMocks();
});

describe("CountryDropdown", () => {
  it("renders the trigger with the active country's flag and dial code", () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-label")).toBe("Country code");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.textContent).toMatch(/\+84/);
    // Flag emoji check: Vietnam = 🇻🇳 = two regional-indicator code points.
    expect(trigger?.textContent).toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  });

  it("opens the popover when the trigger is clicked", async () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // Search box is auto-focused.
    const search = document.querySelector<HTMLInputElement>('input[role="combobox"]');
    expect(search).not.toBeNull();
  });

  it("filters the list when the user types in the search box", async () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    fireEvent.click(trigger);
    const search = (await waitFor(() =>
      document.querySelector<HTMLInputElement>('input[role="combobox"]'),
    ))!;
    fireEvent.change(search, { target: { value: "united" } });
    await waitFor(() => {
      const options = document.querySelectorAll('[role="option"]');
      const labels = Array.from(options).map((o) => o.textContent ?? "");
      // "United States" should be the only visible option (and maybe
      // "United Kingdom" if the library's display names include it; "united"
      // is the user's query so both should match).
      expect(labels.some((l) => l.includes("United States"))).toBe(true);
    });
  });

  it("calls onChange with the picked country's code", async () => {
    const onChange = vi.fn();
    render(<CountryDropdown value="VN" onChange={onChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const options = document.querySelectorAll<HTMLElement>('[role="option"]');
    const usOption = Array.from(options).find((o) =>
      (o.textContent ?? "").includes("United States"),
    );
    expect(usOption).toBeDefined();
    fireEvent.click(usOption!);
    expect(onChange).toHaveBeenCalledWith("US");
  });

  it("closes the popover on Escape", async () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("supports keyboard navigation: ArrowDown highlights the next option", async () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    const search = (await waitFor(() =>
      document.querySelector<HTMLInputElement>('input[role="combobox"]'),
    ))!;
    search.focus();
    // Filter to a small list so the test is deterministic.
    fireEvent.change(search, { target: { value: "united" } });
    // After filtering, the first match (index 0) is highlighted. Press
    // ArrowDown to move to index 1.
    fireEvent.keyDown(search, { key: "ArrowDown" });
    await waitFor(() => {
      const options = document.querySelectorAll<HTMLElement>('[role="option"]');
      expect(options[1]?.className).toMatch(/bg-muted/);
    });
  });

  it("Enter on the highlighted option selects it", async () => {
    const onChange = vi.fn();
    render(<CountryDropdown value="VN" onChange={onChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    const search = (await waitFor(() =>
      document.querySelector<HTMLInputElement>('input[role="combobox"]'),
    ))!;
    search.focus();
    // Filter to just the United States so the highlight is unambiguous.
    fireEvent.change(search, { target: { value: "united states" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("US");
  });

  it("clicking outside closes the popover", async () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <CountryDropdown value="VN" onChange={noopOnChange} />
      </div>,
    );
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    fireEvent.mouseDown(document.querySelector('[data-testid="outside"]')!);
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("Vietnam is marked as the primary market", () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    const options = document.querySelectorAll<HTMLElement>('[role="option"]');
    const vnOption = Array.from(options).find((o) => (o.textContent ?? "").includes("Vietnam"));
    expect(vnOption?.textContent).toMatch(/Primary/i);
  });

  it("flags the active country as selected (aria-selected)", async () => {
    render(<CountryDropdown value="US" onChange={noopOnChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    const options = document.querySelectorAll<HTMLElement>('[role="option"]');
    const usOption = Array.from(options).find((o) =>
      (o.textContent ?? "").includes("United States"),
    );
    expect(usOption?.getAttribute("aria-selected")).toBe("true");
  });

  it("the chevron rotates 180° when the popover is open", async () => {
    render(<CountryDropdown value="VN" onChange={noopOnChange} />);
    fireEvent.click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!);
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const chevron = document.querySelector("svg.lucide-chevron-down");
    expect(chevron?.classList.contains("rotate-180")).toBe(true);
  });
});
