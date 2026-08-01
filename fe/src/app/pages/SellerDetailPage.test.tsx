import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ErrorBoundary } from "../components/error-boundary";
import { ApiError } from "@/shared/api";

const getSellerMock = vi.fn();
const productListMock = vi.fn();

vi.mock("@/shared/api/endpoints/sellers", () => ({
  getSeller: (...args: unknown[]) => getSellerMock(...args),
}));

vi.mock("@/shared/api/endpoints/products", () => ({
  productList: (...args: unknown[]) => productListMock(...args),
}));

import { SellerDetailPage } from "./SellerDetailPage";

const SELLER = {
  id: "s1",
  shopName: "TechZone",
  description: "Best tech shop",
  logoUrl: null,
  bannerUrl: null,
  tier: "STANDARD",
  joinedAt: "2023-01-15T00:00:00Z",
  ratingAvg: 4.5,
  ratingCount: 100,
  totalProducts: 20,
};

function makeWrapper(id = "s1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/sellers/${id}`]}>
          <Routes>
            <Route
              path="/sellers/:id"
              element={
                <ErrorBoundary>
                  <Suspense fallback={<div>Loading…</div>}>{children}</Suspense>
                </ErrorBoundary>
              }
            />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { Wrapper };
}

beforeEach(() => {
  getSellerMock.mockReset();
  productListMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SellerDetailPage", () => {
  it("renders seller info on happy path", async () => {
    getSellerMock.mockResolvedValue(SELLER);
    productListMock.mockResolvedValue({ content: [], totalElements: 0 });

    const { Wrapper } = makeWrapper();
    render(<SellerDetailPage />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText("TechZone")).toBeInTheDocument());
    expect(screen.getByText("STANDARD")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact seller" })).toHaveAttribute(
      "href",
      "/messages?with=s1",
    );
  });

  it("renders not-found state on 404", async () => {
    getSellerMock.mockRejectedValue(new ApiError(404, "SELLER_NOT_FOUND", "not found"));
    productListMock.mockResolvedValue({ content: [], totalElements: 0 });

    const { Wrapper } = makeWrapper("ghost");
    render(<SellerDetailPage />, { wrapper: Wrapper });

    // useSuspenseQuery throws on error — the ErrorBoundary catches it and
    // renders the ApiError message.
    await waitFor(() => expect(screen.getByText("not found")).toBeInTheDocument());
  });

  it("renders empty product grid when seller has no products", async () => {
    getSellerMock.mockResolvedValue({ ...SELLER, totalProducts: 0 });
    productListMock.mockResolvedValue({ content: [], totalElements: 0 });

    const { Wrapper } = makeWrapper();
    render(<SellerDetailPage />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText("TechZone")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText("This shop has no products yet.")).toBeInTheDocument(),
    );
  });
});
