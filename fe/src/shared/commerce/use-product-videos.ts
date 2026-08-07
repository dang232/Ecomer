import { useQuery } from "@tanstack/react-query";

import { videosByEntity } from "@/shared/api/endpoints/videos";
import type { Video } from "@/shared/contracts/api/video";

export function useProductVideos(productId: string, options?: { enabled?: boolean }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["videos", "product", productId],
    queryFn: () => videosByEntity(productId, "PRODUCT"),
    enabled: Boolean(productId) && (options?.enabled ?? true),
  });

  const videos: Video[] = data?.videos ?? [];

  return { videos, isLoading, isError, refetch };
}
