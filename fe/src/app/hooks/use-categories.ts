import { queryOptions, useQuery } from "@tanstack/react-query";

import { categoryTree } from "@/shared/api/endpoints/categories";
import type { Category } from "@/shared/contracts";

export const categoriesOptions = () =>
  queryOptions<Category[]>({
    queryKey: ["catalog", "categories"] as const,
    queryFn: () => categoryTree(),
  });

export function useCategories() {
  return useQuery(categoriesOptions());
}
