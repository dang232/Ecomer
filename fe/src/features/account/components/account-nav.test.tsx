import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AccountNav } from "./account-nav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AccountNav", () => {
  it("renders URL-owned account links and marks the current route", () => {
    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <AccountNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "account.sections.profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "account.sections.wishlist" })).toHaveAttribute(
      "href",
      "/wishlist",
    );
    expect(screen.getByRole("link", { name: "account.sections.notifications" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "account.sections.messages" })).toHaveAttribute(
      "href",
      "/messages",
    );
    expect(screen.getByRole("link", { name: "account.sections.returns" })).toHaveAttribute(
      "href",
      "/returns",
    );
  });
});
