import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn<() => { roles: string[] }>();
const useAppConfigMock =
  vi.fn<() => { support: { phone: string; email: string; hours: string } }>();

const translations: Record<string, string> = {
  "footer.startSelling": "Start Selling",
  "footer.sellerCenter": "Seller Center",
  "footer.sellerTools": "Seller Tools",
  "footer.fees": "Fees",
  "footer.help": "Help & Support",
  "footer.helpCenter": "Help Center",
  "footer.returns": "Returns & Refunds",
  "footer.shipping": "Shipping & Delivery",
  "footer.contactUs": "Contact Us",
  "footer.about": "About Us",
  "footer.careers": "Careers",
  "footer.blog": "Blog & News",
  "footer.press": "Press",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
  "footer.support.helpCenterDescription":
    "Get help with your orders, deliveries, returns, and account.",
  "footer.support.shippingDescription":
    "Review delivery status in your orders or contact our support team for help.",
  "footer.support.contactDescription":
    "Contact VNShop support for help with an order or your account.",
  "footer.support.aboutDescription": "About VNShop",
  "footer.support.careersDescription": "Career opportunities",
  "footer.support.blogDescription": "VNShop updates",
  "footer.support.pressDescription": "Press enquiries",
  "footer.support.privacyDescription": "Privacy information",
  "footer.support.termsDescription": "Terms information",
  "footer.support.viewOrders": "View orders",
  "footer.support.manageReturns": "Manage returns",
  "footer.support.phone": "Phone",
  "footer.support.email": "Email",
  "footer.support.hours": "Support hours",
  "footer.support.unavailable": "Support contact details are temporarily unavailable.",
  "footer.support.close": "Close",
};

vi.mock("../hooks/auth-context", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../hooks/use-app-config", () => ({ useAppConfig: () => useAppConfigMock() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      translations[key] ?? options?.defaultValue ?? key,
  }),
}));

import { Footer } from "./footer";

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ roles: ["BUYER"] });
  useAppConfigMock.mockReturnValue({
    support: { phone: "1800 6789", email: "support@vnshop.vn", hours: "24/7" },
  });
});

describe("Footer", () => {
  it("sends buyers through seller registration while preserving seller destinations", () => {
    const buyerFooter = renderFooter();

    expect(screen.getByRole("link", { name: "Start Selling" })).toHaveAttribute(
      "href",
      "/seller/register",
    );
    expect(screen.getByRole("link", { name: "Seller Center" })).toHaveAttribute(
      "href",
      "/seller/register",
    );
    expect(screen.getByRole("link", { name: "Seller Tools" })).toHaveAttribute(
      "href",
      "/seller/register",
    );
    expect(screen.getByRole("link", { name: "Fees" })).toHaveAttribute("href", "/seller/register");

    buyerFooter.unmount();
    useAuthMock.mockReturnValue({ roles: ["SELLER"] });
    renderFooter();

    expect(screen.getByRole("link", { name: "Start Selling" })).toHaveAttribute("href", "/seller");
    expect(screen.getByRole("link", { name: "Seller Tools" })).toHaveAttribute(
      "href",
      "/seller/products",
    );
    expect(screen.getByRole("link", { name: "Fees" })).toHaveAttribute("href", "/seller/wallet");
  });

  it("routes the real footer destinations", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "Returns & Refunds" })).toHaveAttribute(
      "href",
      "/returns",
    );
    expect(screen.getByRole("link", { name: "All Categories" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("button", { name: "Shipping & Delivery" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Design System" })).not.toBeInTheDocument();
  });

  it.each([
    ["Help Center", "Help Center"],
    ["Shipping & Delivery", "Shipping & Delivery"],
    ["Contact Us", "Contact Us"],
    ["About Us", "About Us"],
    ["Careers", "Careers"],
    ["Blog & News", "Blog & News"],
    ["Press", "Press"],
    ["Privacy Policy", "Privacy Policy"],
    ["Terms of Service", "Terms of Service"],
  ])("opens an accessible in-app surface for %s", (control, title) => {
    renderFooter();

    fireEvent.click(screen.getByRole("button", { name: control }));

    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View orders" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Manage returns" })).toHaveAttribute(
      "href",
      "/returns",
    );
  });

  it("exposes configured support contacts in the Help Center", () => {
    renderFooter();

    fireEvent.click(screen.getByRole("button", { name: "Help Center" }));

    expect(screen.getByRole("link", { name: "1800 6789" })).toHaveAttribute("href", "tel:18006789");
    expect(screen.getByRole("link", { name: "support@vnshop.vn" })).toHaveAttribute(
      "href",
      "mailto:support@vnshop.vn",
    );
  });
});
