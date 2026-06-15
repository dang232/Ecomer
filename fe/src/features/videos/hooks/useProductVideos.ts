import { useQuery } from "@tanstack/react-query";

import { videosByEntity } from "../../../app/lib/api/endpoints/videos";
import type { Video } from "../../../app/types/api/video";

/**
 * Fetches all published videos attached to a product.
 * Returns an empty array while loading or if the product has no videos.
 */
export function useProductVideos(productId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["videos", "product", productId],
    queryFn: () => videosByEntity(productId, "PRODUCT"),
    enabled: !!productId,
  });

  const videos: Video[] = data?.videos ?? [];

  return { videos, isLoading };
}
