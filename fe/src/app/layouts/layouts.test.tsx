import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "./AuthLayout";
import { StandaloneLayout } from "./StandaloneLayout";

describe("route-owned layouts", () => {
  it("gives auth routes the single main landmark", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<div>Login form</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByText("Login form")).toBeVisible();
  });

  it("does not add chrome around standalone provider returns", () => {
    render(
      <MemoryRouter initialEntries={["/payment/return/vnpay"]}>
        <Routes>
          <Route element={<StandaloneLayout />}>
            <Route path="/payment/return/:provider" element={<div>Payment return</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Payment return")).toBeVisible();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});
