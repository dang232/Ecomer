import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { readJsonText } from "../../shared/api/read-json";
import {
  addWishlistItem,
  clearWishlist as clearWishlistApi,
  getWishlist,
  removeWishlistItem,
  toggleWishlistItem,
  type WishlistResponse,
} from "../lib/api/endpoints/wishlist";
import { productIdSchema, type ProductId } from "../types/api/branded-ids";

import { useAuth } from "./auth-context";

const WISHLIST_KEY = ["wishlist"] as const;
const LEGACY_STORAGE_KEY = "vnshop:wishlist";

const EMPTY: WishlistResponse = { productIds: [], items: [] };
const legacyWishlistSchema = z.array(z.string().min(1).brand<"ProductId">());

/**
 * Server-backed wishlist via /users/me/wishlist. The hook lazily migrates the
 * legacy localStorage list (vnshop:wishlist) once on first authenticated load,
 * so users keep their saved items across the cutover.
 */
export function useWishlist() {
  const { ready, authenticated } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const migrationAttempted = useRef(false);

  const query = useQuery<WishlistResponse>({
    queryKey: WISHLIST_KEY,
    queryFn: getWishlist,
    enabled: ready && authenticated,
    initialData: EMPTY,
    initialDataUpdatedAt: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // One-shot migration: if the user has a non-empty legacy localStorage entry,
  // POST each item to the BE, then clear the local cache. Failures are logged
  // and ignored — the user's local list survives until the next attempt.
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (migrationAttempted.current) return;
    migrationAttempted.current = true;

    let legacyIds: ProductId[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        legacyIds = readJsonText(raw, legacyWishlistSchema);
      }
    } catch {
      /* ignore */
    }
    if (legacyIds.length === 0) return;

    void (async () => {
      const current = qc.getQueryData<WishlistResponse>(WISHLIST_KEY) ?? EMPTY;
      const knownIds = new Set(current.productIds);
      const missing = legacyIds.filter((id) => !knownIds.has(id));
      const failedIds: ProductId[] = [];
      for (const id of missing) {
        try {
          await addWishlistItem(id);
        } catch (err) {
          console.warn("wishlist migration: failed to add", id, err);
          failedIds.push(id);
        }
      }
      if (failedIds.length > 0) {
        // Keep failed items in localStorage so they can be retried next session.
        try {
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(failedIds));
        } catch {
          /* ignore */
        }
        toast.error(t("wishlist.migrationFailed", { count: failedIds.length }));
      } else {
        try {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
      void qc.invalidateQueries({ queryKey: WISHLIST_KEY });
    })();
  }, [ready, authenticated, qc, t]);

  const data = query.data ?? EMPTY;

  const patchAfterToggle = (productId: ProductId, inWishlist: boolean) => {
    const pid = productId;
    qc.setQueryData<WishlistResponse>(WISHLIST_KEY, (prev) => {
      const base = prev ?? EMPTY;
      const has = base.productIds.includes(pid);
      if (inWishlist === has) return base;
      if (inWishlist) {
        return {
          ...base,
          productIds: [pid, ...base.productIds],
          items: [{ productId: pid }, ...base.items],
        };
      }
      return {
        ...base,
        productIds: base.productIds.filter((id) => id !== pid),
        items: base.items.filter((item) => item.productId !== pid),
      };
    });
  };

  const toggleMutation = useMutation<
    { inWishlist: boolean },
    unknown,
    string,
    { previous?: WishlistResponse; nextInWishlist: boolean }
  >({
    mutationFn: async (productId) => toggleWishlistItem(productId),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = qc.getQueryData<WishlistResponse>(WISHLIST_KEY);
      const parsedProductId = productIdSchema.parse(productId);
      const has = previous?.productIds.includes(parsedProductId) ?? false;
      const nextInWishlist = !has;
      patchAfterToggle(parsedProductId, nextInWishlist);
      return { previous, nextInWishlist };
    },
    onSuccess: (result, productId) => {
      patchAfterToggle(productIdSchema.parse(productId), result.inWishlist);
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(WISHLIST_KEY, context.previous);
    },
  });

  const removeMutation = useMutation<unknown, unknown, string, { previous?: WishlistResponse }>({
    mutationFn: removeWishlistItem,
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = qc.getQueryData<WishlistResponse>(WISHLIST_KEY);
      patchAfterToggle(productIdSchema.parse(productId), false);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(WISHLIST_KEY, context.previous);
    },
  });

  const clearMutation = useMutation<unknown, unknown, void, { previous?: WishlistResponse }>({
    mutationFn: () => clearWishlistApi(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = qc.getQueryData<WishlistResponse>(WISHLIST_KEY);
      qc.setQueryData<WishlistResponse>(WISHLIST_KEY, EMPTY);
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) qc.setQueryData(WISHLIST_KEY, context.previous);
    },
  });

  /**
   * @returns true when the toggle resulted in the product being on the wishlist.
   *   The mutation is fire-and-forget; the cache is patched optimistically and
   *   reconciled with the server response once it lands.
   */
  const toggle = (productId: string): boolean => {
    const parsedProductId = productIdSchema.parse(productId);
    const has = data.productIds.includes(parsedProductId);
    toggleMutation.mutate(productId);
    return !has;
  };

  return {
    ids: data.productIds,
    items: data.items,
    count: data.productIds.length,
    has: (productId: string) => data.productIds.includes(productIdSchema.parse(productId)),
    toggle,
    remove: (productId: string) => removeMutation.mutate(productId),
    clear: () => clearMutation.mutate(),
    isLoading: query.isLoading,
    error: query.error,
  };
}
