import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutStepper } from "./CheckoutStepper";

const STEP_LABELS = {
  "checkout.steps.address": "Address",
  "checkout.steps.shipping": "Shipping",
  "checkout.steps.payment": "Payment",
  "checkout.steps.review": "Review",
} as const;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: keyof typeof STEP_LABELS) => STEP_LABELS[key] ?? key,
  }),
}));

describe("CheckoutStepper", () => {
  it("renders a semantic ordered list with one li per step", () => {
    const { container } = render(<CheckoutStepper step="address" onStepChange={vi.fn()} />);
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    // The stepper renders 4 step entries as direct <li> children of the <ol>.
    expect(ol!.children.length).toBe(4);
    for (const child of Array.from(ol!.children)) {
      expect(child.tagName).toBe("LI");
    }
  });

  it("marks the active step with aria-current=step and renders future steps as inert spans", () => {
    render(<CheckoutStepper step="shipping" onStepChange={vi.fn()} />);

    // Active step: shipping → aria-current="step"
    const active = document.querySelector('[data-step-id="shipping"]')!;
    expect(active.getAttribute("aria-current")).toBe("step");

    // Future steps (payment, review) are non-focusable spans
    const future = document.querySelector('[data-step-id="payment"]')!;
    expect(future.tagName).toBe("SPAN");
    expect(future.getAttribute("aria-current")).toBeNull();
    expect(future.hasAttribute("href")).toBe(false);

    // Completed steps (address) are focusable anchors
    const done = document.querySelector('[data-step-id="address"]')!;
    expect(done.tagName).toBe("A");
    expect(done.getAttribute("href")).toBe("#step-address");
  });

  it("shows all future steps as inert spans when on the first step", () => {
    render(<CheckoutStepper step="address" onStepChange={vi.fn()} />);

    const active = document.querySelector('[data-step-id="address"]')!;
    expect(active.getAttribute("aria-current")).toBe("step");

    for (const id of ["shipping", "payment", "review"]) {
      const node = document.querySelector(`[data-step-id="${id}"]`)!;
      expect(node.tagName).toBe("SPAN");
      expect(node.getAttribute("aria-current")).toBeNull();
    }
  });

  it("marks the three prior steps as completed (anchors) once we are on review", () => {
    const { container } = render(<CheckoutStepper step="review" onStepChange={vi.fn()} />);
    // address / shipping / payment are done → anchors; review itself is active → span.
    const anchors = container.querySelectorAll("ol > li a");
    expect(anchors).toHaveLength(3);
    const spans = container.querySelectorAll("ol > li > div > span[data-step-id]");
    expect(spans).toHaveLength(1);
    expect(spans[0].getAttribute("data-step-id")).toBe("review");
  });

  it("focusable step nodes declare a focus-visible ring class", () => {
    render(<CheckoutStepper step="address" onStepChange={vi.fn()} />);

    // address is active → focus-visible classes must be present on the span
    const active = document.querySelector('[data-step-id="address"]')!;
    expect(active.className).toMatch(/focus-visible:ring-2/);

    // future steps must NOT carry a focus-visible ring (they aren't focusable)
    const future = document.querySelector('[data-step-id="payment"]')!;
    expect(future.className).not.toMatch(/focus-visible:ring-2/);
  });

  it("invokes onStepChange with the clicked step id when a completed step is clicked", () => {
    const onStepChange = vi.fn();
    render(<CheckoutStepper step="payment" onStepChange={onStepChange} />);

    const done = document.querySelector('[data-step-id="address"]')! as HTMLAnchorElement;
    done.click();
    expect(onStepChange).toHaveBeenCalledWith("address");
  });

  it("renders localized labels instead of leaking translation keys", () => {
    render(<CheckoutStepper step="payment" onStepChange={vi.fn()} />);

    for (const id of ["address", "shipping", "payment", "review"]) {
      const node = document.querySelector(`[data-step-id="${id}"]`)!;
      expect(node.getAttribute("aria-label")).toBe(
        STEP_LABELS[`checkout.steps.${id}` as keyof typeof STEP_LABELS],
      );
    }
    expect(screen.getByText("Shipping")).toBeInTheDocument();
    expect(screen.queryByText("checkout.steps.shipping")).not.toBeInTheDocument();
  });
});
