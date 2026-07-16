import { fireEvent, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { Field } from "./field";
import { IconButton } from "./icon-button";
import { StatusIndicator } from "./status-indicator";
import { Tabs } from "./tabs";

describe("shared UI primitives", () => {
  it("uses safe button defaults and a stable target size", () => {
    render(<Button>Apply filters</Button>);
    const button = screen.getByRole("button", { name: "Apply filters" });

    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("min-h-[var(--target-web)]");
  });

  it("announces and disables pending actions", () => {
    render(
      <Button pendingLabel="Saving changes" pending>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving changes" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("requires an accessible icon-button label and exposes a tooltip", () => {
    render(
      <IconButton label="Search products">
        <Search />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Search products" });
    expect(button).toHaveAttribute("title", "Search products");
    expect(button.className).toContain("min-h-[var(--target-web)]");
  });

  it("keeps interactive field addons in the accessibility tree", () => {
    render(
      <Field
        id="phone"
        label="Phone number"
        helperText="Choose a country code"
        addon={<button type="button">Country code</button>}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Phone number" });
    const addon = screen.getByRole("button", { name: "Country code" });
    expect(input).toHaveAttribute("aria-describedby", "phone-helper");
    expect(addon.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("associates field errors without referencing missing helper content", () => {
    render(<Field id="email" label="Email" error="Enter a valid email" />);
    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
  });

  it("moves and selects tabs with the keyboard", () => {
    const onValueChange = vi.fn();
    render(
      <Tabs
        ariaLabel="Order status"
        value="all"
        onValueChange={onValueChange}
        items={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "done", label: "Completed" },
        ]}
      />,
    );

    const all = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith("pending");
    expect(screen.getByRole("tab", { name: "Pending" })).toHaveFocus();
  });

  it("renders status text in addition to color", () => {
    render(<StatusIndicator tone="success">Approved</StatusIndicator>);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });
});
