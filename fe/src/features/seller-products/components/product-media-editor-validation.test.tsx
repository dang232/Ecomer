import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptySellerProductForm, sellerProductFormSchema } from "../model/product-form";
import type { SellerProductForm } from "../model/product-form";

import { ProductEditorDrawer } from "./product-editor-drawer";
import { ProductVideoFields } from "./product-video-fields";

const { categoriesOptionsMock, detailOptionsMock, zodResolverMock, formResolverMock } = vi.hoisted(
  () => {
    const formResolverMock = vi.fn(() => ({ values: {}, errors: {} }));
    return {
      categoriesOptionsMock: vi.fn(() => ({
        queryKey: ["seller-products-media-validation-categories"],
        queryFn: () => Promise.resolve([]),
      })),
      detailOptionsMock: vi.fn((id: string) => ({
        queryKey: ["seller-products-media-validation-detail", id],
        queryFn: () => Promise.resolve(undefined),
      })),
      zodResolverMock: vi.fn(() => formResolverMock),
      formResolverMock,
    };
  },
);

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: zodResolverMock,
}));

vi.mock("@/shared/api/endpoints/products", () => ({
  sellerProductCreate: vi.fn(),
  sellerProductDelete: vi.fn(),
  sellerProductPublish: vi.fn(),
  sellerProductUpdate: vi.fn(),
}));

vi.mock("../api/query-options", () => ({
  sellerProductCategoriesOptions: categoriesOptionsMock,
  sellerProductDetailOptions: detailOptionsMock,
}));

vi.mock("../model/draft-recovery", () => ({
  getDraftRecovery: vi.fn(() => null),
  saveDraftRecovery: vi.fn(),
  clearDraftRecovery: vi.fn(),
}));

vi.mock("@/features/videos", () => ({
  VideoUploadDropzone: ({ onFileSelected }: { onFileSelected: (file: File) => void }) => (
    <button
      type="button"
      aria-label="Upload a product video"
      onClick={() => onFileSelected(new File(["video"], "product.mp4", { type: "video/mp4" }))}
    />
  ),
  VideoUploadProgress: () => null,
  useProductVideos: () => ({ videos: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useVideoUpload: () => ({
    state: {
      phase: "idle",
      progress: 0,
      entityId: null,
      videoId: null,
      error: null,
      estimatedDuration: null,
      filename: null,
    },
    upload: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "seller.products.editor.media.add") return "Add image";
      if (key === "seller.products.editor.media.pending") return "Will upload on save";
      if (key === "seller.products.editor.media.pendingHint") {
        return "Images upload when you save the product.";
      }
      if (key === "seller.products.editor.media.count") {
        return `${String(options?.count)}/${String(options?.max)}`;
      }
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

function renderBlankEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductEditorDrawer
        open
        product={null}
        onClose={vi.fn()}
        onSave={vi.fn(() => Promise.resolve())}
      />
    </QueryClientProvider>,
  );
}

function VideoValidationFixture() {
  const form = useForm<SellerProductForm>({
    resolver: zodResolver(sellerProductFormSchema),
    defaultValues: emptySellerProductForm(),
    mode: "onTouched",
  });

  return (
    <>
      <input aria-label="Name" {...form.register("name")} />
      <ProductVideoFields productId="product-1" />
    </>
  );
}

function renderVideoControl() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VideoValidationFixture />
    </QueryClientProvider>,
  );
}

describe("seller product media/editor validation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zodResolverMock.mockReturnValue(formResolverMock);
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:product-image"),
      });
    }
  });

  it("does not validate the blank product form or log an uncaught Zod error when adding an image", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      renderBlankEditor();
      const nameInput = screen.getByRole("textbox", { name: /name/i });

      await waitFor(() => expect(document.activeElement).toBe(nameInput));
      const addImageButton = screen.getByRole("button", { name: "Add image" });
      const mouseDown = createEvent.mouseDown(addImageButton);
      fireEvent(addImageButton, mouseDown);
      if (!mouseDown.defaultPrevented) addImageButton.focus();
      fireEvent.mouseUp(addImageButton);
      fireEvent.click(addImageButton);

      const imageInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
      expect(imageInput).not.toBeNull();
      fireEvent.change(imageInput!, {
        target: {
          files: [new File(["image"], "product.png", { type: "image/png" })],
        },
      });

      await waitFor(() => expect(screen.getByText("Will upload on save")).toBeInTheDocument());
      expect(formResolverMock).not.toHaveBeenCalled();
      expect(
        consoleError.mock.calls.flat().some((argument) => String(argument).includes("ZodError")),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not validate the blank product form or log an uncaught Zod error when opening video upload", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      renderVideoControl();
      const nameInput = screen.getByRole("textbox", { name: "Name" });

      nameInput.focus();
      const uploadButton = screen.getByRole("button", { name: "Upload a product video" });
      const mouseDown = createEvent.mouseDown(uploadButton);
      fireEvent(uploadButton, mouseDown);
      if (!mouseDown.defaultPrevented) uploadButton.focus();
      fireEvent.mouseUp(uploadButton);
      fireEvent.click(uploadButton);

      expect(formResolverMock).not.toHaveBeenCalled();
      expect(
        consoleError.mock.calls.flat().some((argument) => String(argument).includes("ZodError")),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
