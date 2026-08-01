import { z } from "zod";

import { productSummarySchema } from "./product";
import { cursorPageSchema } from "./shared";

const facetEntrySchema = z
  .object({
    key: z.string(),
    label: z.string().optional(),
    count: z.number(),
  })
  .passthrough();

export const searchFacetsSchema = z
  .object({
    categories: z.array(facetEntrySchema),
    brands: z.array(facetEntrySchema),
    tags: z.array(facetEntrySchema).default([]),
  })
  .passthrough();
export type SearchFacets = z.infer<typeof searchFacetsSchema>;

export const searchV2Schema = cursorPageSchema(productSummarySchema).extend({
  facets: searchFacetsSchema.optional(),
});
export type SearchV2 = z.infer<typeof searchV2Schema>;
