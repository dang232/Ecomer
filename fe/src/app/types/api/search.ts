import { z } from "zod";

import { cursorPageSchema } from "./shared";
import { productSummarySchema } from "./product";

const facetEntrySchema = z
  .object({
    key: z.string(),
    count: z.number(),
  })
  .passthrough();

export const searchFacetsSchema = z
  .object({
    categories: z.array(facetEntrySchema),
    brands: z.array(facetEntrySchema),
  })
  .passthrough();
export type SearchFacets = z.infer<typeof searchFacetsSchema>;

export const searchV2Schema = cursorPageSchema(productSummarySchema).extend({
  facets: searchFacetsSchema.optional(),
});
export type SearchV2 = z.infer<typeof searchV2Schema>;
