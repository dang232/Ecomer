/* eslint-disable react-refresh/only-export-components --
 * VNShopProvider keeps the legacy useVNShop hook colocated to avoid touching
 * every importing page during the live-API migration. New code should pull
 * from useAuth / useCart / useWishlist directly.
 */
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "../hooks/use-auth";
import { useCart } from "../hooks/use-cart";
import { useProfile } from "../hooks/use-profile";
import { useWishlist } from "../hooks/use-wishlist";
import type { Product } from "../types/ui";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: "buyer" | "seller" | "admin";
}

interface VNShopContextType {
  // Cart actions still wired through here so the existing product cards keep working.
  cartCount: number;
  addToCart: (
    product: Product,
    quantity?: number,
    variant?: { color?: string; size?: string; variantId?: string },
  ) => void;
  // Wishlist — backed by /users/me/wishlist (user-service BE-8).
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  // Auth — backed by the gateway's native cookie session.
  user: User | null;
  isLoggedIn: boolean;
  logout: () => void;
  // Theme.
  isDark: boolean;
  toggleTheme: () => void;
}

const VNShopContext = createContext<VNShopContextType | null>(null);

function pickRole(roles: string[]): "buyer" | "seller" | "admin" {
  if (roles.includes("ADMIN")) return "admin";
  if (roles.includes("SELLER")) return "seller";
  return "buyer";
}

export function VNShopProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useTranslation();
  const wishlistStore = useWishlist();
  const cart = useCart();
  // /users/me carries the buyer's avatarUrl (uploaded via the profile camera
  // button -> object storage). Gate on auth so guests don't fire 401s.
  const profileQuery = useProfile({ enabled: auth.ready && auth.authenticated });
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("vnshop:theme") === "dark";
    } catch {
      return false;
    }
  });

  // Sync the HTML class on mount so the initial value from localStorage takes effect.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cartCount = cart.itemCount;

  const addToCart = useCallback(
    (
      product: Product,
      quantity = 1,
      variant?: { color?: string; size?: string; variantId?: string },
    ) => {
      if (!auth.authenticated) {
        toast.error(t("context.loginToAddCart"), {
          action: {
            label: t("context.loginLabel"),
            onClick: () => {
              window.location.href = "/login";
            },
          },
        });
        return;
      }
      const variantDesc = [variant?.color, variant?.size].filter(Boolean).join(", ");
      cart.addItem(
        { productId: product.id, quantity, variantId: variant?.variantId },
        {
          onSuccess: () =>
            toast.success(
              t("context.addedToCart", {
                name: `${product.name.slice(0, 30)}${product.name.length > 30 ? "..." : ""}`,
              }),
              {
                description: variantDesc
                  ? t("context.addedToCartVariant", { variantDesc, quantity })
                  : t("context.addedToCartQty", { quantity }),
              },
            ),
        },
      );
    },
    [auth.authenticated, cart, t],
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      if (!auth.authenticated) {
        toast.error(t("context.loginToSave"), {
          action: {
            label: t("context.loginLabel"),
            onClick: () => {
              window.location.href = "/login";
            },
          },
        });
        return;
      }
      const added = wishlistStore.toggle(productId);
      if (added) toast.success(t("context.addedToWishlist"));
      else toast.info(t("context.removedFromWishlist"));
    },
    [auth.authenticated, wishlistStore, t],
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlistStore.has(productId),
    [wishlistStore],
  );

  const logout = useCallback(() => {
    toast.info("Đã đăng xuất khỏi tài khoản");
    auth.logout();
  }, [auth]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("vnshop:theme", next ? "dark" : "light");
      } catch {
        // localStorage may be unavailable in private browsing
      }
      return next;
    });
  }, []);

  const user = useMemo<User | null>(() => {
    if (!auth.authenticated) return null;
    const profile = auth.profile;
    const buyerProfile = profileQuery.data;
    const fullName =
      buyerProfile?.name ??
      (profile?.firstName || profile?.lastName
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim()
        : (profile?.username ?? profile?.email ?? "Người dùng"));
    return {
      id: auth.subject ?? profile?.id ?? "",
      name: fullName,
      email: profile?.email ?? "",
      phone: buyerProfile?.phone ?? "",
      // BE returns avatarUrl on BuyerProfileResponse; the userProfileSchema
      // transform aliases it to `avatar`. Falls back to "" so the avatar
      // button still renders the initial-letter placeholder for users who
      // never uploaded one.
      avatar: buyerProfile?.avatar ?? "",
      role: pickRole(auth.roles),
    };
  }, [auth.authenticated, auth.profile, auth.roles, auth.subject, profileQuery.data]);

  // Stable reference for wishlist array to prevent context re-renders
  const wishlistIds = wishlistStore.ids;

  const value = useMemo<VNShopContextType>(
    () => ({
      cartCount,
      addToCart,
      wishlist: wishlistIds,
      toggleWishlist,
      isWishlisted,
      user,
      isLoggedIn: !!user,
      logout,
      isDark,
      toggleTheme,
    }),
    [
      cartCount,
      addToCart,
      wishlistIds,
      toggleWishlist,
      isWishlisted,
      user,
      logout,
      isDark,
      toggleTheme,
    ],
  );

  return <VNShopContext.Provider value={value}>{children}</VNShopContext.Provider>;
}

export function useVNShop() {
  const ctx = useContext(VNShopContext);
  if (!ctx) throw new Error("useVNShop must be used within VNShopProvider");
  return ctx;
}
