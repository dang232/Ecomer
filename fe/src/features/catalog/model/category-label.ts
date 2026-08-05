import type { Category } from "@/shared/contracts";

export function categoryDisplayLabel(category: Pick<Category, "id" | "name" | "label">): string {
  return category.label ?? category.name ?? category.id;
}
