import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Price } from "./price";
import { Rating } from "./rating";
import { TrustCues } from "./trust-cues";

describe("shared commerce patterns", () => {
  it("clamps ratings and handles missing values without an empty visual slot", () => {
    const { rerender } = render(<Rating value={9} soldCount={2_300} />);

    expect(screen.getByLabelText("5 out of 5 stars")).toBeVisible();
    expect(screen.getByText("2.3k sold")).toBeVisible();

    rerender(<Rating />);
    expect(screen.queryByLabelText(/stars/)).not.toBeInTheDocument();
  });

  it("shows a discount only when the original price is greater", () => {
    const { rerender } = render(<Price priceVnd={1_250_000} originalPriceVnd={1_500_000} />);
    expect(screen.getByText("-17%")).toBeVisible();

    rerender(<Price priceVnd={1_500_000} originalPriceVnd={1_250_000} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("uses text and an icon for each trust cue", () => {
    render(
      <TrustCues
        cues={[
          { id: "buyer-protection", label: "Buyer protection", detail: "Payment held safely" },
          { id: "returns", label: "Easy returns" },
          { id: "shipping", label: "Tracked delivery" },
        ]}
      />,
    );

    expect(screen.getByText("Buyer protection")).toBeVisible();
    expect(screen.getByText("Easy returns")).toBeVisible();
    expect(screen.getByText("Tracked delivery")).toBeVisible();
  });
});
