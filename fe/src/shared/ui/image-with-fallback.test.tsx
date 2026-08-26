import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageWithFallback } from "@/shared/ui";

describe("ImageWithFallback", () => {
  it("renders the image when src is provided", () => {
    render(<ImageWithFallback src="https://cdn/x.jpg" alt="Product" className="w-10 h-10" />);
    const img = screen.getByAltText<HTMLImageElement>("Product");
    expect(img.tagName).toBe("IMG");
    expect(img.src).toBe("https://cdn/x.jpg");
    expect(img.loading).toBe("lazy");
  });

  it("forwards responsive sizes and an explicit srcSet without changing alt semantics", () => {
    render(
      <ImageWithFallback
        src="https://cdn/x.jpg"
        alt="Product"
        sizes="(min-width: 768px) 25vw, 50vw"
        srcSet="https://cdn/x-320.jpg 320w, https://cdn/x-640.jpg 640w"
      />,
    );

    const img = screen.getByAltText<HTMLImageElement>("Product");
    expect(img.sizes).toBe("(min-width: 768px) 25vw, 50vw");
    expect(img.srcset).toBe("https://cdn/x-320.jpg 320w, https://cdn/x-640.jpg 640w");
  });

  it("renders the placeholder when src is empty", () => {
    const { container } = render(<ImageWithFallback src="" alt="placeholder" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByLabelText("placeholder")).toBeInTheDocument();
  });

  it("swaps to fallbackSrc on the first error, then to placeholder on the second", () => {
    render(
      <ImageWithFallback
        src="https://cdn/missing.jpg"
        fallbackSrc="https://cdn/fallback.jpg"
        alt="Product"
      />,
    );
    const img = screen.getByAltText("Product");
    fireEvent.error(img);
    // Still in image mode but using the fallback URL.
    const after = screen.getByAltText<HTMLImageElement>("Product");
    expect(after.src).toBe("https://cdn/fallback.jpg");

    fireEvent.error(after);
    // Now placeholder takes over.
    expect(screen.queryByAltText("Product")).toBeNull();
    expect(screen.getByLabelText("Product")).toBeInTheDocument();
  });

  it("drops the original srcSet when switching to a fallback image", () => {
    render(
      <ImageWithFallback
        src="https://cdn/missing.jpg"
        fallbackSrc="https://cdn/fallback.jpg"
        alt="Product"
        srcSet="https://cdn/missing-320.jpg 320w"
      />,
    );

    const img = screen.getByAltText<HTMLImageElement>("Product");
    expect(img.srcset).toBe("https://cdn/missing-320.jpg 320w");

    fireEvent.error(img);

    expect(screen.getByAltText<HTMLImageElement>("Product").srcset).toBe("");
  });

  it("goes straight to placeholder on error when no fallbackSrc is provided", () => {
    render(<ImageWithFallback src="https://cdn/missing.jpg" alt="Product" />);
    const img = screen.getByAltText("Product");
    fireEvent.error(img);
    expect(screen.queryByAltText("Product")).toBeNull();
    expect(screen.getByLabelText("Product")).toBeInTheDocument();
  });
});
