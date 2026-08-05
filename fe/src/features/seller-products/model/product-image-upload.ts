import {
  sellerProductImageActivate,
  sellerProductImageUploadUrl,
} from "@/shared/api/endpoints/products";
import { sha256FileHex } from "@/shared/lib/sha256";

export interface PendingProductImage {
  id: string;
  file: File;
  previewUrl: string;
  alt: string;
  sortOrder: number;
}

export interface PersistedProductImage {
  url: string;
  alt?: string;
  sortOrder: number;
}

export class ProductImageUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProductImageUploadError";
    this.status = status;
  }
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      // Some otherwise capable browsers reject createImageBitmap for a valid
      // local image. Fall through to the broadly supported image decoder.
    }
  }

  return imageElementDimensions(file);
}

function imageElementDimensions(file: File): Promise<{ width: number; height: number }> {
  const previewUrl = URL.createObjectURL(file);
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(previewUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new ProductImageUploadError("image_dimensions_unavailable"));
    };
    image.src = previewUrl;
  });
}

export async function uploadProductImage(
  productId: string,
  pendingImage: PendingProductImage,
): Promise<PersistedProductImage> {
  const { file } = pendingImage;
  const dimensions = await imageDimensions(file);
  const checksum = await sha256FileHex(file);
  const contentType = file.type;
  const metadata = {
    fileName: file.name,
    declaredContentType: contentType,
    detectedContentType: contentType,
    contentLength: file.size,
    sha256Hex: checksum,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
  };

  const upload = await sellerProductImageUploadUrl(productId, metadata);
  const putResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.uploadHeaders,
    body: file,
    signal: AbortSignal.timeout(30_000),
  });
  if (!putResponse.ok) {
    throw new ProductImageUploadError("image_upload_failed", putResponse.status);
  }

  const activated = await sellerProductImageActivate(productId, {
    objectKey: upload.objectKey,
    detectedContentType: contentType,
    contentLength: file.size,
    sha256Hex: checksum,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
  });

  return {
    url: activated.url,
    alt: pendingImage.alt,
    sortOrder: pendingImage.sortOrder,
  };
}

export async function uploadProductImages(
  productId: string,
  pendingImages: readonly PendingProductImage[],
): Promise<PersistedProductImage[]> {
  const uploaded: PersistedProductImage[] = [];
  for (const pendingImage of pendingImages) {
    uploaded.push(await uploadProductImage(productId, pendingImage));
  }
  return uploaded;
}
