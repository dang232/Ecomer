/**
 * Test for ProductEditorDrawer.
 *
 * Creation returns DRAFT; the ACTIVE list cannot refetch it.
 * Draft recovery persists the returned product ID + validated form values
 * under a seller-specific sessionStorage key.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as draftRecovery from "../model/draft-recovery";
import type { SellerProductForm } from "../model/product-form";

import { ProductEditorDrawer } from "./product-editor-drawer";

const { useVideoUploadMock, useVideoStatusMock, useProductVideosMock } = vi.hoisted(() => ({
  useVideoUploadMock: vi.fn(() => ({
    state: {
      phase: "idle" as const,
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
  })),
  useVideoStatusMock: vi.fn(() => ({
    status: undefined,
    data: undefined,
    isStuck: false,
    error: null,
    isLoading: false,
  })),
  useProductVideosMock: vi.fn(() => ({
    videos: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/features/videos", () => ({
  VideoUploadDropzone: () => <div data-testid="video-upload-dropzone" />,
  VideoUploadProgress: ({ videoId }: { videoId: string }) => (
    <div data-testid="video-upload-progress" data-video-id={videoId} />
  ),
  useVideoUpload: useVideoUploadMock,
  useVideoStatus: useVideoStatusMock,
  useProductVideos: useProductVideosMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "video.seller.sectionTitle") {
        return `Videos (${String(options?.count)}/${String(options?.max)})`;
      }
      if (key === "seller.products.editor.videoCreateHint") {
        return "Save the product first, then add videos from the edit screen.";
      }
      return key;
    },
  }),
}));

vi.mock("../api/query-options", () => ({
  sellerProductCategoriesOptions: () => ({
    queryKey: ["seller-products-test-categories"],
    queryFn: () => Promise.resolve([]),
  }),
  sellerProductDetailOptions: (id: string) => ({
    queryKey: ["seller-products-test-detail", id],
    queryFn: () => Promise.resolve({}),
  }),
}));

// ── Mock child sections so we test drawer-level logic only ─────────────────────

vi.mock("./product-basic-fields", () => ({
  ProductBasicFields: () => <div data-testid="basic-fields">BasicFields</div>,
}));

vi.mock("./product-media-fields", () => ({
  ProductMediaFields: () => <div data-testid="media-fields">MediaFields</div>,
}));

vi.mock("./product-variant-fields", () => ({
  ProductVariantFields: () => <div data-testid="variant-fields">VariantFields</div>,
}));

vi.mock("./product-publication", () => ({
  ProductPublication: ({ onPublish }: { onPublish: () => void }) => (
    <button data-testid="publication" onClick={onPublish}>
      Publication
    </button>
  ),
}));

// ── Mock draft recovery to control recoveredDraft state synchronously ─────────────

vi.mock("../model/draft-recovery", () => ({
  getDraftRecovery: vi.fn(() => null),
  saveDraftRecovery: vi.fn(),
  clearDraftRecovery: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function withQueryClient(element: React.ReactElement) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>;
}

const renderDrawer = (
  open: boolean,
  product: null | { id: string },
  onClose: () => void,
  onSave: (values: SellerProductForm) => Promise<void>,
) =>
  render(
    withQueryClient(
      <ProductEditorDrawer open={open} product={product} onClose={onClose} onSave={onSave} />,
    ),
  );

describe("ProductEditorDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four sections when a draft is recovered", async () => {
    vi.mocked(draftRecovery.getDraftRecovery).mockReturnValueOnce({
      productId: "draft-1",
      formValues: {
        name: "Draft",
        description: "",
        categoryId: "",
        brand: "",
        tags: [],
        images: [],
        offerMode: "single",
        offer: { sku: "", priceAmount: 0, stockQuantity: 0 },
        variants: [],
      },
    });
    renderDrawer(true, null, vi.fn(), vi.fn());
    await waitFor(() => {
      expect(screen.getByTestId("publication")).toBeInTheDocument();
    });
    expect(screen.getByTestId("basic-fields")).toBeInTheDocument();
    expect(screen.getByTestId("media-fields")).toBeInTheDocument();
    expect(screen.getByTestId("variant-fields")).toBeInTheDocument();
  });

  it("renders the drawer title for create mode", () => {
    renderDrawer(true, null, vi.fn(), vi.fn());
    // drawer title is h2, section headers are h3
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renders the drawer title for edit mode", () => {
    renderDrawer(true, { id: "p-1" }, vi.fn(), vi.fn());
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("shows Cancel and Save buttons in the footer", () => {
    renderDrawer(true, null, vi.fn(), vi.fn());
    expect(
      screen.getByRole("button", { name: /seller\.products\.editor\.cancel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /seller\.products\.editor\.saveDraft/i }),
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked (form is not dirty)", () => {
    const onClose = vi.fn();
    renderDrawer(true, null, onClose, vi.fn());
    fireEvent.click(screen.getByRole("button", { name: /seller\.products\.editor\.cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no publication mock when opened in edit mode", () => {
    renderDrawer(true, { id: "p-1" }, vi.fn(), vi.fn());
    expect(screen.queryByTestId("publication")).not.toBeInTheDocument();
  });

  it("mounts the product video upload boundary after a draft has a server ID", async () => {
    vi.mocked(draftRecovery.getDraftRecovery).mockReturnValueOnce({
      productId: "draft-video-1",
      formValues: {
        name: "Draft",
        description: "",
        categoryId: "",
        brand: "",
        tags: [],
        images: [],
        offerMode: "single",
        offer: { sku: "", priceAmount: 0, stockQuantity: 0 },
        variants: [],
      },
    });

    renderDrawer(true, null, vi.fn(), vi.fn());

    await waitFor(() => {
      expect(screen.getByTestId("video-upload-dropzone")).toBeInTheDocument();
    });

    expect(useVideoUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "draft-video-1", context: "PRODUCT" }),
    );
    expect(useProductVideosMock).toHaveBeenCalledWith("draft-video-1");
  });

  it("shows the three-slot video state without mounting upload before a new product is persisted", () => {
    renderDrawer(true, null, vi.fn(), vi.fn());

    expect(screen.getByRole("group", { name: "Videos (0/3)" })).toBeInTheDocument();
    expect(
      screen.getByText("Save the product first, then add videos from the edit screen."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("video-upload-dropzone")).not.toBeInTheDocument();
    expect(useVideoUploadMock).not.toHaveBeenCalled();
  });
});
