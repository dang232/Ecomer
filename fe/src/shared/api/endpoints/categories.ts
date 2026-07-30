import { z } from "zod";

import type { Category } from "@/shared/contracts/api";
import { categorySchema } from "@/shared/contracts/api/category";
import { api } from "@/shared/api/client";

export const categoryTree = async (): Promise<Category[]> => {
  return api.get("/categories", z.array(categorySchema), undefined, { auth: false });
};

export function flattenCategoryTree(categories: Category[]): Category[] {
  return categories.flatMap((category) => {
    const children = (category.children ?? []) as Category[];
    return [category, ...flattenCategoryTree(children)];
  });
}
