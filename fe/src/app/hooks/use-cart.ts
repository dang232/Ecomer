import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useCallback } from "react";

import {
  addCartItem,
  clearCart as clearCartApi,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../lib/api/endpoints/cart";
import { productById } from "../lib/api/endpoints/products";
import { fromServer, findVariant } from "../lib/api/product-mapper";
import type { Cart } from "../types/api";
import type { ProductId, SellerId } from "../types/api/branded-ids";

import { useAuth } from "./use-auth";

const CART_KEY = ["cart"] as const;
const GUEST_STORAGE_KEY = "vnshop:guest-cart";

const EMPTY_CART: Cart = { items: [], itemCount: 0, totalAmount: 0 };

interface GuestCartItem {
  productId: string;
  quantity: number;
  variantId?: string;
}

function readGuestCart(): GuestCartItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is GuestCartItem =>
          typeof it === "object" &&
          it !== null &&
          typeof (it as GuestCartItem).productId === "string" &&
          typeof (it as GuestCartItem).quantity === "number" &&
          (it as GuestCartItem).quantity > 0 &&
          (typeof (it as GuestCartItem).variantId === "string" ||
            (it as GuestCartItem).variantId === undefined),
      )
      .map((it) => ({ productId: it.productId, quantity: it.quantity, variantId: it.variantId }));
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } else {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    /* quota exceeded, private mode, etc. — guest cart degrades to in-memory */
  }
}

function guestItemsToCart(items: GuestCartItem[]): Cart {
  return {
    items: items.map((it) => ({
      productId: it.productId as ProductId,
      name: undefined,
      image: undefined,
      price: 0,
      quantity: it.quantity,
      sellerId: undefined,
      variantId: it.variantId,
    })),
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    totalAmount: 0,
  };
}

/** Compute optimistic cart state for an "add" before the server has responded. */
function optimisticAdd(
  cart: Cart | undefined,
  productId: string,
  quantity: number,
  variantId?: string,
): Cart {
  const base = cart ?? EMPTY_CART;
  const items = [...(base.items ?? [])];
  const existing = items.findIndex((i) => i.productId === productId && i.variantId === variantId);
  if (existing >= 0) {
    items[existing] = { ...items[existing], quantity: items[existing].quantity + quantity };
  } else {
    // Skeleton item — name/price/image will reconcile from the server response.
    items.push({
      productId: productId as ProductId,
      name: undefined,
      image: undefined,
      price: 0,
      quantity,
      sellerId: undefined,
      variantId,
    });
  }
  return recomputeTotals({ ...base, items });
}

function optimisticUpdate(cart: Cart | undefined, productId: string, quantity: number): Cart {
  const base = cart ?? EMPTY_CART;
  const items = (base.items ?? []).map((i) => (i.productId === productId ? { ...i, quantity } : i));
  return recomputeTotals({ ...base, items });
}

function optimisticRemove(cart: Cart | undefined, productId: string): Cart {
  const base = cart ?? EMPTY_CART;
  const items = (base.items ?? []).filter((i) => i.productId !== productId);
  return recomputeTotals({ ...base, items });
}

function recomputeTotals(cart: Cart): Cart {
  const items = cart.items ?? [];
  return {
    ...cart,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    totalAmount: items.reduce((s, i) => s + i.price * i.quantity, 0),
  };
}

/**
 * Cart hook with guest-mode + merge-on-login.
 *
 * <p>Anonymous users get a localStorage-backed cart so they can browse, add
 * items, and view /cart without being forced to log in first. On
 * authentication, the guest items are replayed into the server cart in a
 * one-shot migration (mirrors the wishlist pattern). After that point the
 * hook is server-backed and behaves like the original implementation.
 *
 * <p>The merge is additive: server-side quantities are preserved and guest
 * quantities are summed in. Failures during merge are logged and swallowed
 * so a partial outage doesn't block login — the guest cart survives until
 * the next attempt.
 */
export function useCart() {
  const { authenticated, ready } = useAuth();
  const qc = useQueryClient();
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>(() => readGuestCart());

  const query = useQuery<Cart>({
    queryKey: CART_KEY,
    queryFn: getCart,
    enabled: ready && authenticated,
    refetchOnWindowFocus: true,
  });

  const addItem = useMutation<
    Cart,
    unknown,
    { productId: string; quantity: number; variantId?: string },
    { previous?: Cart }
  >({
    mutationFn: (input) => addCartItem(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: CART_KEY });
      const previous = qc.getQueryData<Cart>(CART_KEY);
      if (query.isSuccess) {
        qc.setQueryData<Cart>(CART_KEY, (curr) =>
          optimisticAdd(curr, input.productId, input.quantity, input.variantId),
        );
      }
      return { previous };
    },
    onSuccess: (cart) => qc.setQueryData(CART_KEY, cart),
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(CART_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  const updateItem = useMutation<
    Cart,
    unknown,
    { productId: string; quantity: number },
    { previous?: Cart }
  >({
    mutationFn: ({ productId, quantity }) => updateCartItem(productId, { quantity }),
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: CART_KEY });
      const previous = qc.getQueryData<Cart>(CART_KEY);
      if (query.isSuccess) {
        qc.setQueryData<Cart>(CART_KEY, (curr) => optimisticUpdate(curr, productId, quantity));
      }
      return { previous };
    },
    onSuccess: (cart) => qc.setQueryData(CART_KEY, cart),
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(CART_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  const removeItem = useMutation<Cart, unknown, string, { previous?: Cart }>({
    mutationFn: (productId) => removeCartItem(productId),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: CART_KEY });
      const previous = qc.getQueryData<Cart>(CART_KEY);
      qc.setQueryData<Cart>(CART_KEY, (curr) => optimisticRemove(curr, productId));
      return { previous };
    },
    onSuccess: (cart) => qc.setQueryData(CART_KEY, cart),
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(CART_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  const clear = useMutation<unknown, unknown, void, { previous?: Cart }>({
    mutationFn: () => clearCartApi(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: CART_KEY });
      const previous = qc.getQueryData<Cart>(CART_KEY);
      qc.setQueryData<Cart>(CART_KEY, EMPTY_CART);
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(CART_KEY, context.previous);
      else void qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });

  // Guest-mode mutations: localStorage-backed, no server round-trip.
  const isGuest = ready && !authenticated;

  const guestAdd = (productId: string, quantity: number, variantId?: string) => {
    setGuestItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.productId === productId && i.variantId === variantId,
      );
      const next =
        existing >= 0
          ? prev.map((i, idx) => (idx === existing ? { ...i, quantity: i.quantity + quantity } : i))
          : [...prev, { productId, quantity, variantId }];
      writeGuestCart(next);
      return next;
    });
  };

  const guestUpdate = (productId: string, quantity: number, variantId?: string) => {
    setGuestItems((prev) => {
      const next =
        quantity <= 0
          ? prev.filter((i) => !(i.productId === productId && i.variantId === variantId))
          : prev.map((i) =>
              i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i,
            );
      writeGuestCart(next);
      return next;
    });
  };

  const guestRemove = (productId: string, variantId?: string) => {
    setGuestItems((prev) => {
      const next = prev.filter((i) => !(i.productId === productId && i.variantId === variantId));
      writeGuestCart(next);
      return next;
    });
  };

  const guestClear = () => {
    setGuestItems([]);
    writeGuestCart([]);
  };

  // For guest carts, fan-out product fetches to hydrate name/image/price.
  // `useQueries` runs in parallel; once all settle `isHydrating` becomes false.
  const productQueries = useQueries({
    queries: guestItems.map((item) => ({
      queryKey: ["product", item.productId] as const,
      queryFn: () => productById(item.productId),
      staleTime: 5 * 60 * 1000,
      enabled: isGuest,
    })),
  });

  // Hydrating as long as any guest product fetch is still pending.
  const isHydrating = isGuest && guestItems.length > 0 && productQueries.some((q) => q.isPending);

  // Build a richer cart for guest mode by overlaying resolved product data.
  // findVariant resolves the selected SKU so variant products render the
  // correct price/image instead of always falling back to variants[0].
  const hydratedGuestCart: Cart | undefined = isGuest
    ? {
        ...guestItemsToCart(guestItems),
        items: guestItems.map((item, idx) => {
          const raw = productQueries[idx]?.data;
          if (!raw) {
            return {
              productId: item.productId as ProductId,
              name: undefined,
              image: undefined,
              price: 0,
              quantity: item.quantity,
              sellerId: undefined,
              variantId: item.variantId,
            };
          }
          const variant = findVariant(raw, item.variantId);
          const mapped = fromServer(raw);
          const price = variant?.priceAmount ?? mapped.price;
          const image = variant?.imageUrl ?? mapped.image;
          return {
            productId: item.productId as ProductId,
            name: mapped.name,
            image,
            price,
            originalPrice: mapped.originalPrice,
            quantity: item.quantity,
            sellerId: mapped.sellerId as SellerId,
            variantId: item.variantId,
          };
        }),
        totalAmount: guestItems.reduce((sum, item, idx) => {
          const raw = productQueries[idx]?.data;
          if (!raw) return sum;
          const variant = findVariant(raw, item.variantId);
          const price = variant?.priceAmount ?? fromServer(raw).price;
          return sum + price * item.quantity;
        }, 0),
      }
    : undefined;

  const cart = isGuest ? hydratedGuestCart : query.data;
  const items = cart?.items ?? [];
  const itemCount = cart?.itemCount ?? items.reduce((n, i) => n + i.quantity, 0);
  const totalAmount = cart?.totalAmount ?? items.reduce((s, i) => s + i.price * i.quantity, 0);

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const mergeApprovedRef = useRef(false);
  const [isMerging, setIsMerging] = useState(false);

  // Showing the dialog is deliberately separate from merging: merely
  // authenticating must never move guest items into the saved cart.
  const requestMerge = useCallback(() => {
    if (!ready || !authenticated || guestItems.length === 0) return;
    if (!query.isSuccess || !query.data) return;
    mergeApprovedRef.current = false;
    setShowMergeDialog(true);
  }, [ready, authenticated, guestItems.length, query.isSuccess, query.data]);

  // The only guest -> server merge path. The dialog's Merge action grants
  // consent immediately before this work starts; there is no login-time merge.
  // addCartItem is additive for a matching product/variant: server 5 + guest
  // 2 is sent as quantity 2 and becomes 7, subject to the server's item cap.
  const mergeGuestItems = useCallback(async (): Promise<boolean> => {
    if (!ready || !authenticated) return false;
    if (!query.isSuccess || !query.data) return false;
    if (!mergeApprovedRef.current) return false;

    setIsMerging(true);
    const failedItems: GuestCartItem[] = [];
    let mergedCart = query.data;

    try {
      for (const item of guestItems) {
        // Check for variant warning
        if (item.variantId === undefined) {
          console.warn(
            `[cart] merge called without variantId for product ${item.productId} — ` +
              `variant selection may be lost`,
          );
        }

        try {
          mergedCart = await addCartItem({
            productId: item.productId,
            quantity: item.quantity,
            variantId: item.variantId,
          });
        } catch (err) {
          console.warn("cart merge: failed to add", item.productId, err);
          failedItems.push(item);
        }
      }

      // Clear guest cart only if all items succeeded
      if (failedItems.length === 0) {
        writeGuestCart([]);
        setGuestItems([]);
        qc.setQueryData(CART_KEY, mergedCart);
      } else {
        writeGuestCart(failedItems);
        setGuestItems(failedItems);
      }

      setShowMergeDialog(false);
      mergeApprovedRef.current = false;
      return failedItems.length === 0;
    } finally {
      setIsMerging(false);
    }
  }, [ready, authenticated, guestItems, query.data, query.isSuccess, qc]);

  const executeMerge = useCallback(async (): Promise<boolean> => {
    if (!showMergeDialog || isMerging) return false;
    mergeApprovedRef.current = true;
    return mergeGuestItems();
  }, [isMerging, mergeGuestItems, showMergeDialog]);

  // Keep carts separate (don't merge)
  const keepSeparate = useCallback(() => {
    mergeApprovedRef.current = false;
    setShowMergeDialog(false);
  }, []);

  // Calculate item counts for merge dialog
  const guestItemCount = guestItems.reduce((n, i) => n + i.quantity, 0);
  const serverItemCount = query.data?.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;

  // Check if there are items without variant selection
  const hasItemsWithoutVariant = guestItems.some((item) => item.variantId === undefined);

  return {
    cart,
    items,
    itemCount,
    totalAmount,
    isGuest,
    isHydrating,
    isLoading: isGuest ? false : query.isLoading,
    isReady: isGuest ? true : query.isSuccess,
    error: isGuest ? null : query.error,
    // Merge-related state and functions
    showMergeDialog,
    isMerging,
    requestMerge,
    executeMerge,
    keepSeparate,
    guestItemCount,
    serverItemCount,
    hasItemsWithoutVariant,
    addItem: (
      input: { productId: string; quantity: number; variantId?: string },
      options?: Parameters<typeof addItem.mutate>[1],
    ) => {
      if (isGuest) {
        guestAdd(input.productId, input.quantity, input.variantId);
        return;
      }
      if (!query.isSuccess) return;
      return addItem.mutate(input, options);
    },
    addItemAsync: async (input: { productId: string; quantity: number; variantId?: string }) => {
      if (isGuest) {
        guestAdd(input.productId, input.quantity, input.variantId);
        return;
      }
      if (!query.isSuccess) return;
      await addItem.mutateAsync(input);
    },
    updateItem: (
      input: { productId: string; quantity: number; variantId?: string },
      options?: Parameters<typeof updateItem.mutate>[1],
    ) => {
      if (isGuest) {
        guestUpdate(input.productId, input.quantity, input.variantId);
        return;
      }
      if (!query.isSuccess) return;
      // Cart service keys variant items as productId:variantId
      const itemKey = input.variantId ? `${input.productId}:${input.variantId}` : input.productId;
      return updateItem.mutate({ productId: itemKey, quantity: input.quantity }, options);
    },
    removeItem: (
      input: string | { productId: string; variantId?: string },
      options?: Parameters<typeof removeItem.mutate>[1],
    ) => {
      if (isGuest) {
        if (typeof input === "string") {
          guestRemove(input);
        } else {
          guestRemove(input.productId, input.variantId);
        }
        return;
      }
      if (!query.isSuccess) return;
      // Cart service keys variant items as productId:variantId
      const productId = typeof input === "string" ? input : input.productId;
      const variantId = typeof input === "string" ? undefined : input.variantId;
      const itemKey = variantId ? `${productId}:${variantId}` : productId;
      return removeItem.mutate(itemKey, options);
    },
    clear: (options?: Parameters<typeof clear.mutate>[1]) => {
      if (isGuest) {
        guestClear();
        return;
      }
      if (!query.isSuccess) return;
      return clear.mutate(undefined, options);
    },
    refetch: query.refetch,
  };
}
