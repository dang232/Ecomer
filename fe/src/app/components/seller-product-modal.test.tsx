import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SellerProductModal } from "./seller-product-modal";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const videoDeleteMock = vi.fn();
const videosByEntityMock = vi.fn();
const useVideoUploadMock = vi.fn();

// Mutable per-test state for the videos list. The vi.mock factory below
// closes over this object, so mutating `.list` in place propagates to the
// mocked hook without re-importing.
const videosState: {
  list: {
    id: string;
    entityId: string;
    context: "PRODUCT";
    status: "PUBLISHED";
    originalFilename?: string;
  }[];
} = { list: [] };

let mockUploadReturn: Record<string, unknown> = {
  state: {
    phase: "idle",
    progress: 0,
    videoId: null,
    error: null,
    estimatedDuration: null,
    filename: null,
  },
  upload: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
  retry: vi.fn(),
};

vi.mock("../lib/api/endpoints/videos", () => ({
  videoDelete: (...args: unknown[]) => videoDeleteMock(...args),
  videosByEntity: (...args: unknown[]) => videosByEntityMock(...args),
}));

vi.mock("../../features/videos/hooks/useProductVideos", () => ({
  useProductVideos: () => ({
    videos: videosState.list,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../features/videos/hooks/useVideoUpload", () => ({
  useVideoUpload: (_options: { onComplete?: () => void; onError?: (e: Error) => void }) =>
    useVideoUploadMock(),
}));

vi.mock("../../features/videos/components/VideoUploadDropzone", () => ({
  VideoUploadDropzone: () => <div data-testid="video-dropzone" />,
}));

vi.mock("../../features/videos/components/VideoUploadProgress", () => ({
  VideoUploadProgress: () => <div data-testid="video-progress" />,
}));

vi.mock("./image-with-fallback", () => ({
  ImageWithFallback: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

vi.mock("../lib/api/endpoints/products", () => ({
  sellerProductCreate: vi.fn(),
  sellerProductImageActivate: vi.fn(),
  sellerProductImageUploadUrl: vi.fn(),
  sellerProductUpdate: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    name: "Test product",
    nameEn: "Test product",
    price: 100000,
    originalPrice: 120000,
    image: "https://example.com/img.jpg",
    images: ["https://example.com/img.jpg"],
    category: "electronics",
    categoryLabel: "Electronics",
    sellerId: "seller-1",
    sellerName: "Test seller",
    rating: 4.5,
    reviewCount: 10,
    sold: 100,
    stock: 10,
    description: "A test product",
    shipping: "Standard",
    shippingFee: 0,
    location: "HCM",
    tags: [],
    ...overrides,
  };
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, createElement(Toaster, null), children);
  }
  return Wrapper;
}

function renderModal(props: Partial<React.ComponentProps<typeof SellerProductModal>> = {}) {
  const onClose = vi.fn();
  const product = props.product ?? makeProduct();
  const utils = render(<SellerProductModal open onClose={onClose} product={product} {...props} />, {
    wrapper: makeWrapper(),
  });
  return { ...utils, onClose };
}

function setVideos(list: typeof videosState.list) {
  videosState.list = list;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  videoDeleteMock.mockReset();
  videosByEntityMock.mockReset();
  useVideoUploadMock.mockReset();
  setVideos([]);
  mockUploadReturn = {
    state: {
      phase: "idle",
      progress: 0,
      videoId: null,
      error: null,
      estimatedDuration: null,
      filename: null,
    },
    upload: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    retry: vi.fn(),
  };
  useVideoUploadMock.mockReturnValue(mockUploadReturn);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SellerProductModal — P2-5 confirm dialogs", () => {
  it("does not render either ConfirmDialog when the modal is first opened", () => {
    renderModal();
    expect(screen.queryByRole("dialog", { name: /removeVideoTitle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /cancelUpload/i })).not.toBeInTheDocument();
  });

  it("shows the remove-video ConfirmDialog when the remove button is clicked, and does not delete yet", async () => {
    setVideos([
      {
        id: "vid-1",
        entityId: "prod-1",
        context: "PRODUCT",
        status: "PUBLISHED",
        originalFilename: "promo.mp4",
      },
    ]);

    renderModal();

    const removeBtn = screen.getByRole("button", { name: /removeVideo$/i });
    fireEvent.click(removeBtn);

    // Dialog appears
    expect(await screen.findByRole("dialog", { name: /removeVideoTitle/i })).toBeInTheDocument();
    // Delete is NOT called until the user confirms
    expect(videoDeleteMock).not.toHaveBeenCalled();
  });

  it("calls videoDelete and closes the dialog when the confirm button is clicked", async () => {
    setVideos([
      {
        id: "vid-42",
        entityId: "prod-1",
        context: "PRODUCT",
        status: "PUBLISHED",
        originalFilename: "promo.mp4",
      },
    ]);

    videoDeleteMock.mockResolvedValueOnce(undefined);

    renderModal();

    // Open the dialog
    fireEvent.click(screen.getByRole("button", { name: /removeVideo$/i }));
    const dialog = await screen.findByRole("dialog", { name: /removeVideoTitle/i });

    // The dialog has two buttons: Cancel (border-styled) and the danger-styled
    // primary confirm (class `bg-error`). Scope to the dialog and pick the
    // confirm button by its variant class.
    const confirmBtn = dialog.querySelector<HTMLButtonElement>("button.bg-error");
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(videoDeleteMock).toHaveBeenCalledWith("vid-42");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /removeVideoTitle/i })).not.toBeInTheDocument();
    });
  });

  it("does not call videoDelete when the cancel button is clicked", async () => {
    setVideos([
      {
        id: "vid-99",
        entityId: "prod-1",
        context: "PRODUCT",
        status: "PUBLISHED",
        originalFilename: "promo.mp4",
      },
    ]);

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /removeVideo$/i }));
    const dialog = await screen.findByRole("dialog", { name: /removeVideoTitle/i });

    // The cancel button is the border-styled one.
    const cancelBtn = dialog.querySelector<HTMLButtonElement>("button.border-border");
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn!);

    expect(videoDeleteMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /removeVideoTitle/i })).not.toBeInTheDocument();
    });
  });
});
