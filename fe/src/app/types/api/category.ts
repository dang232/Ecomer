import { z } from "zod";

export const categorySchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    label: z.string().optional(),
    parentId: z.string().nullable().optional(),
    children: z.array(z.lazy((): z.ZodType => categorySchema)).optional(),
  })
  .passthrough();
export type Category = z.infer<typeof categorySchema>;
