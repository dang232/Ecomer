import { publicSellerSchema, publicSellersPageSchema } from "@/shared/contracts/api";
import { api } from "@/shared/api/client";

export const getSeller = (id: string) =>
  api.get(`/sellers/${encodeURIComponent(id)}`, publicSellerSchema, undefined, { auth: false });

export interface ListSellersParams {
  page?: number;
  size?: number;
}

export const listSellers = (opts: ListSellersParams = {}) =>
  api.get(
    "/sellers",
    publicSellersPageSchema,
    { page: opts.page ?? 0, size: opts.size ?? 12 },
    { auth: false },
  );
