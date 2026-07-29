import { createContext } from "react";

import type { Product } from "../types/ui";

export interface VNShopContextType {
  cartCount: number;
  addToCart: (
    product: Product,
    quantity?: number,
    variant?: { color?: string; size?: string; variantId?: string },
  ) => void;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    role: "buyer" | "seller" | "admin";
  } | null;
  isLoggedIn: boolean;
  logout: (redirectTo?: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const VNShopContext = createContext<VNShopContextType | null>(null);
