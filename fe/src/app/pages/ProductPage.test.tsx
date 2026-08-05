import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductSellerInput } from "@/features/product";

const useProductSellerMock = vi.fn<(sellerId: string) => ProductSellerInput>();
const mutateQuestionMock = vi.hoisted(() => vi.fn());
const questionQueryState = vi.hoisted(() => ({
  data: undefined as
    readonly { id: string; question: string; answer?: string | null }[] | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));
const canonicalQuestionResponse = vi.hoisted(() => ({
  id: "question-1",
  productId: "camera-1",
  userId: "buyer-1",
  question: "Does this include a warranty?",
  answer: null,
  answeredAt: null,
  createdAt: "2026-08-05T08:00:00Z",
}));
const authState = vi.hoisted(() => ({ authenticated: false }));
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<object>("@tanstack/react-query");
  return {
    ...actual,
    useSuspenseQuery: () => ({ data: PRODUCT }),
    useQuery: () => questionQueryState,
    useMutation: (options: { onSuccess?: (data: { id: string }) => void }) => {
      return {
        mutate: (question: string) => {
          mutateQuestionMock(question);
          options.onSuccess?.(canonicalQuestionResponse);
        },
        isPending: false,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/features/product", async () => {
  const actual = await vi.importActual<object>("@/features/product");
  return { ...actual, useProductSeller: (sellerId: string) => useProductSellerMock(sellerId) };
});

vi.mock("@/features/reviews", () => ({
  ProductReviewsSection: () => <div>Reviews</div>,
  useProductReviewController: () => ({ summary: null }),
}));

vi.mock("@/features/videos", () => ({
  VideoPlayer: () => <div>Video</div>,
  VideoPlayerSkeleton: () => <div>Video loading</div>,
  useProductVideos: () => ({ videos: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("../hooks/use-vnshop", () => ({
  useVNShop: () => ({ addToCart: vi.fn(), toggleWishlist: vi.fn(), isWishlisted: () => false }),
}));
vi.mock("../hooks/auth-context", () => ({
  useAuth: () => ({ authenticated: authState.authenticated, login: vi.fn() }),
}));
vi.mock("../hooks/use-recently-viewed", () => ({
  useRecentlyViewed: () => ({ items: [], addToRecentlyViewed: vi.fn() }),
}));
vi.mock("../hooks/use-recommendations", () => ({
  useFrequentlyBoughtTogether: () => ({ data: [] }),
  useYouMayAlsoLike: () => ({ data: [] }),
}));
vi.mock("../../utils/meta-tags", () => ({ usePageMeta: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn() },
}));

import { ProductPage } from "./ProductPage";

const PRODUCT = {
  id: "camera-1",
  name: "Camera Pro",
  nameEn: "Camera Pro",
  price: 1_000_000,
  image: "",
  images: [],
  category: "electronics",
  categoryLabel: "Electronics",
  sellerId: "seller-1",
  sellerName: "",
  rating: 4.8,
  reviewCount: 10,
  sold: 12,
  stock: 8,
  description: "A camera.",
  shipping: "Standard",
  shippingFee: 0,
  location: "Vietnam",
  tags: [],
  variants: [],
};

function renderPage(initialEntry = "/product/camera-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductPage", () => {
  beforeEach(() => {
    useProductSellerMock.mockReset();
    authState.authenticated = false;
    mutateQuestionMock.mockReset();
    questionQueryState.data = [];
    questionQueryState.isLoading = false;
    questionQueryState.isError = false;
    questionQueryState.refetch.mockReset();
    toastSuccessMock.mockReset();
  });

  it("queries the decoded product seller and keeps purchase details available while pending", () => {
    useProductSellerMock.mockReturnValue({ status: "loading" });
    renderPage();

    expect(useProductSellerMock).toHaveBeenCalledWith("seller-1");
    expect(screen.getByTestId("product-seller-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Camera Pro" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Add to cart" })) {
      expect(button).toBeEnabled();
    }
  });

  it("keeps purchase information available when the seller lookup fails", () => {
    useProductSellerMock.mockReturnValue({ status: "unavailable" });
    renderPage();

    expect(screen.queryByTestId("product-seller-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Camera Pro" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Buy now" })) {
      expect(button).toBeEnabled();
    }
  });

  it("shows success and clears the draft after a canonical question response is accepted", () => {
    authState.authenticated = true;
    useProductSellerMock.mockReturnValue({ status: "unavailable" });
    renderPage("/product/camera-1?section=questions");

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Does this include a warranty?" } });
    fireEvent.click(screen.getByRole("button", { name: "product.qa.submit" }));

    expect(mutateQuestionMock).toHaveBeenCalledWith("Does this include a warranty?");
    expect(toastSuccessMock).toHaveBeenCalledWith("product.qa.submitOk");
    expect(textarea).toHaveValue("");
  });

  it("surfaces question list errors instead of rendering the empty state", () => {
    questionQueryState.isError = true;
    questionQueryState.data = undefined;
    useProductSellerMock.mockReturnValue({ status: "unavailable" });
    renderPage("/product/camera-1?section=questions");

    expect(screen.getByText("Unable to load questions.")).toBeInTheDocument();
    expect(screen.queryByText("product.qa.empty")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(questionQueryState.refetch).toHaveBeenCalledTimes(1);
  });
});
