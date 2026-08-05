import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sellerProductImageActivate,
  sellerProductImageUploadUrl,
} from "@/shared/api/endpoints/products";

import { uploadProductImage } from "./product-image-upload";

const ABC_DIGEST = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

vi.mock("@/shared/api/endpoints/products", () => ({
  sellerProductImageActivate: vi.fn(),
  sellerProductImageUploadUrl: vi.fn(),
}));

describe("uploadProductImage", () => {
  beforeEach(() => {
    vi.mocked(sellerProductImageUploadUrl).mockResolvedValue({
      objectKey: "products/p-1/images/front.png",
      uploadUrl: "http://minio/upload",
      uploadHeaders: {
        "Content-Type": "image/png",
        "x-amz-meta-storage-class": "PRODUCT_IMAGE",
      },
      checksumSha256: "a".repeat(64),
      quarantineState: "PENDING_VALIDATION",
      expiresInSeconds: 300,
    });
    vi.mocked(sellerProductImageActivate).mockResolvedValue({
      objectKey: "products/p-1/images/front.png",
      checksumSha256: "a".repeat(64),
      quarantineState: "ACTIVE",
      url: "http://localhost:9000/vnshop-products/products/p-1/images/front.png",
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({
        width: 800,
        height: 600,
        close: vi.fn(),
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
      },
    });
  });

  it("sends the backend metadata contract and returns the persisted URL", async () => {
    const file = new File(["image-bytes"], "front.png", { type: "image/png" });
    const result = await uploadProductImage("p-1", {
      id: "image-1",
      file,
      previewUrl: "blob:http://localhost/preview",
      alt: "Front view",
      sortOrder: 0,
    });

    expect(sellerProductImageUploadUrl).toHaveBeenCalledWith("p-1", {
      fileName: "front.png",
      declaredContentType: "image/png",
      detectedContentType: "image/png",
      contentLength: file.size,
      sha256Hex: "0".repeat(64),
      imageWidth: 800,
      imageHeight: 600,
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://minio/upload",
      expect.objectContaining({
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "image/png",
          "x-amz-meta-storage-class": "PRODUCT_IMAGE",
        },
      }),
    );
    expect(sellerProductImageActivate).toHaveBeenCalledWith("p-1", {
      objectKey: "products/p-1/images/front.png",
      detectedContentType: "image/png",
      contentLength: file.size,
      sha256Hex: "0".repeat(64),
      imageWidth: 800,
      imageHeight: 600,
    });
    expect(result).toEqual({
      url: "http://localhost:9000/vnshop-products/products/p-1/images/front.png",
      alt: "Front view",
      sortOrder: 0,
    });
  });

  it("uses the fallback checksum when Web Crypto is unavailable", async () => {
    vi.stubGlobal("crypto", undefined);
    const file = new File(["abc"], "front.png", { type: "image/png" });

    await uploadProductImage("p-1", {
      id: "image-1",
      file,
      previewUrl: "blob:http://localhost/preview",
      alt: "Front view",
      sortOrder: 0,
    });

    expect(sellerProductImageUploadUrl).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({ sha256Hex: ABC_DIGEST }),
    );
    expect(sellerProductImageActivate).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({ sha256Hex: ABC_DIGEST }),
    );
  });

  it("falls back to the browser image decoder when createImageBitmap rejects", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bitmap unavailable")));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:http://localhost/fallback-image"),
      revokeObjectURL,
    });
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 640;
        naturalHeight = 480;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    await uploadProductImage("p-1", {
      id: "image-1",
      file: new File(["image-bytes"], "fallback.png", { type: "image/png" }),
      previewUrl: "blob:http://localhost/preview",
      alt: "Fallback image",
      sortOrder: 0,
    });

    expect(sellerProductImageUploadUrl).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({ imageWidth: 640, imageHeight: 480 }),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/fallback-image");
  });
});
