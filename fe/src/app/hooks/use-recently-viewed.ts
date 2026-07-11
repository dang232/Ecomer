import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vnshop:recently-viewed";
const DEFAULT_LIMIT = 20;

export interface RecentlyViewedItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  rating: number;
  viewedAt: number;
}

/**
 * Recently viewed products hook - stores in localStorage for MVP.
 * NOTE: This is per-device only.
 * ponytail: TODO — cross-device sync via user account (post-auth MVP)
 */
export function useRecentlyViewed(limit: number = DEFAULT_LIMIT) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RecentlyViewedItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.slice(0, limit));
        }
      }
    } catch {
      /* ignore malformed data */
    }
  }, [limit]);

  const addToRecentlyViewed = useCallback(
    (productId: string, data: Omit<RecentlyViewedItem, "productId" | "viewedAt">) => {
      if (typeof localStorage === "undefined") return;

      setItems((prev) => {
        // Remove existing entry for this product (will be re-added at front)
        const filtered = prev.filter((item) => item.productId !== productId);

        // Add new entry at the beginning
        const newItem: RecentlyViewedItem = {
          productId,
          ...data,
          viewedAt: Date.now(),
        };

        const newItems = [newItem, ...filtered].slice(0, limit);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
        } catch {
          /* quota exceeded, private mode, etc. — degrade gracefully */
        }

        return newItems;
      });
    },
    [limit],
  );

  const clearRecentlyViewed = useCallback(() => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setItems([]);
  }, []);

  return {
    items,
    addToRecentlyViewed,
    clearRecentlyViewed,
    isEmpty: items.length === 0,
  };
}
