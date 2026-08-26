import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductGallery } from "./product-gallery";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; index?: number }) => {
      if (key === "product.gallery") return "Product media gallery";
      if (key === "product.viewImage") return `View image ${options?.index ?? ""}`.trim();
      return options?.defaultValue ?? key;
    },
  }),
}));

describe("ProductGallery", () => {
  const media = [{ id: "1", url: "/camera-1.png", alt: "Camera front" }];

  it("uses the canonical media gallery label for empty and populated regions", () => {
    const { rerender } = render(<ProductGallery media={[]} />);

    expect(screen.getByLabelText("Product media gallery")).toBeInTheDocument();

    rerender(
      <ProductGallery
        media={[
          { id: "1", url: "/camera-1.png", alt: "Camera front" },
          { id: "2", url: "/camera-2.png", alt: "Camera back" },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Product media gallery" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Product media gallery")).toHaveLength(2);
  });

  it("renders a visible accessible close button that dismisses the zoomed image", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));

    const closeButton = screen.getByRole("button", { name: "Close zoomed view" });
    expect(closeButton).toBeVisible();

    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus to the close button when the zoomed image opens", () => {
    render(<ProductGallery media={media} />);

    const trigger = screen.getByRole("button", { name: "Open zoomed view" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close zoomed view" }));
  });

  it("wraps forward Tab focus at the dialog boundary", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));
    const closeButton = screen.getByRole("button", { name: "Close zoomed view" });
    const tabEvent = createEvent.keyDown(closeButton, { key: "Tab" });
    fireEvent(closeButton, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
  });

  it("wraps reverse Tab focus at the dialog boundary", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));
    const closeButton = screen.getByRole("button", { name: "Close zoomed view" });
    const tabEvent = createEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    fireEvent(closeButton, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
  });

  it("restores focus to the zoom trigger when the zoomed image closes", () => {
    render(<ProductGallery media={media} />);

    const trigger = screen.getByRole("button", { name: "Open zoomed view" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close zoomed view" }));

    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses the zoomed image when Escape is pressed", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses the zoomed image when the backdrop is clicked", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));
    fireEvent.mouseDown(screen.getByRole("dialog"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the zoomed image open when the image itself is clicked", () => {
    render(<ProductGallery media={media} />);

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed view" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("img", { name: "Camera front" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a pointer-position magnifier while hovering the main image", () => {
    render(<ProductGallery media={media} />);
    const region = screen.getByRole("region", { name: "Product media gallery" });

    vi.spyOn(region, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      top: 0,
      right: 400,
      bottom: 400,
      left: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(region, { clientX: 100, clientY: 200, pointerType: "mouse" });

    expect(screen.getByTestId("product-image-magnifier")).toBeVisible();
    expect(screen.getByTestId("product-image-magnifier")).toHaveStyle({
      backgroundPosition: "25% 50%",
    });
  });
});
