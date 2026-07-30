import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineAlert } from "./inline-alert";
import { PageSkeleton } from "./page-skeleton";
import { Progress } from "./progress";
import { TableToolbar } from "./table-toolbar";

describe("shared UI accessibility", () => {
  it("uses named roles for operational status controls", () => {
    render(
      <>
        <TableToolbar ariaLabel="Order filters">
          <button type="button">Filter</button>
        </TableToolbar>
        <InlineAlert tone="danger" title="Payment failed">
          Try a different payment method.
        </InlineAlert>
        <Progress label="Upload progress" value={45} />
      </>,
    );

    expect(screen.getByRole("toolbar", { name: "Order filters" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Payment failed");
    expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute(
      "aria-valuenow",
      "45",
    );
  });

  it("gives loading skeletons an accessible status role", () => {
    render(<PageSkeleton />);

    expect(screen.getByRole("status", { name: "Loading content" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
