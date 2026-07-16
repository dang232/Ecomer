import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "./FormField";

describe("FormField compatibility component", () => {
  it("does not hide an interactive addon from assistive technology", () => {
    render(
      <FormField id="phone" label="Phone" addon={<button type="button">Choose country</button>} />,
    );

    expect(
      screen.getByRole("button", { name: "Choose country" }).closest("[aria-hidden]"),
    ).toBeNull();
  });
});
