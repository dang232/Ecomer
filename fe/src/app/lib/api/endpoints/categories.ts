import { z } from "zod";

import type { Category } from "../../../types/api";
import { categorySchema } from "../../../types/api/category";
import { api } from "../client";

export const categoryTree = async (): Promise<Category[]> => {
  return api.get("/categories", z.array(categorySchema), undefined, { auth: false });
};
