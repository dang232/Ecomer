import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutPageView } from "./checkout-page-view";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("CheckoutPageView", () => {
  it("keeps the current stage and order summary in a responsive composition", () => {
    render(
      <CheckoutPageView
        step="address"
        onBack={vi.fn()}
        stepper={<div>stepper</div>}
        stage={<div>address stage</div>}
        summary={<div>order summary</div>}
      />,
    );

    expect(screen.getByText("address stage")).toBeInTheDocument();
    expect(screen.getByText("order summary")).toBeInTheDocument();
  });
});
