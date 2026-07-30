import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { SellerProfile } from "@/shared/contracts/api/seller";

import { SellerProfileSummary } from "./seller-profile-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makeProfile(overrides?: Partial<SellerProfile>): SellerProfile {
  return {
    id: "s-1",
    shopName: "My Shop",
    bankName: "Vietcombank",
    approved: true,
    tier: "STANDARD",
    vacationMode: false,
    destination: null,
    ...overrides,
  };
}

describe("SellerProfileSummary", () => {
  it("renders shop name and tier", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ shopName: "Test Shop", tier: "PREMIUM" })} />);
    expect(screen.getByText("Test Shop")).toBeInTheDocument();
    expect(screen.getByText("PREMIUM")).toBeInTheDocument();
  });

  it("renders approved badge when approved", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ approved: true })} />);
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("renders pending badge when not approved", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ approved: false })} />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders vacation mode on when enabled", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ vacationMode: true })} />);
    expect(screen.getByText("seller.settings.vacationOn")).toBeInTheDocument();
  });

  it("renders vacation mode off when disabled", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ vacationMode: false })} />);
    expect(screen.getByText("seller.settings.vacationOff")).toBeInTheDocument();
  });

  it("renders bank name when provided", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ bankName: "VietinBank" })} />);
    expect(screen.getByText("VietinBank")).toBeInTheDocument();
  });

  it("renders notProvided when bank name is null", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ bankName: null })} />);
    // bankName null → 1; destination null → 2 more (destination + verificationState)
    expect(screen.getAllByText("common.notProvided")).toHaveLength(3);
  });

  it("renders masked destination last4 when provided", () => {
    renderWithRouter(
      <SellerProfileSummary
        profile={makeProfile({
          destination: {
            destinationId: "d-1",
            bankName: "ACB",
            last4: "1234",
            verificationState: "VERIFIED",
          },
        })}
      />
    );
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
  });

  it("renders notProvided when destination is null", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile({ destination: null })} />);
    // destination null renders two notProvided fields (destination + verificationState)
    expect(screen.getAllByText("common.notProvided")).toHaveLength(2);
  });

  it("has no Save button", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile()} />);
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("has no editable fields", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("has no coming soon text", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile()} />);
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("renders plaintext account numbers nowhere", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile()} />);
    // A full account number is at least 8 digits
    const digits = screen.queryAllByText(/\d{8,}/);
    expect(digits).toHaveLength(0);
  });

  it("links to buyer-account profile", () => {
    renderWithRouter(<SellerProfileSummary profile={makeProfile()} />);
    const link = screen.getByRole("link", { name: /seller\.settings\.manageAccount/i });
    expect(link).toHaveAttribute("href", "/profile");
  });
});
