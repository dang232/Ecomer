import { useContext } from "react";

import { VNShopContext } from "../components/vnshop-context-value";

export function useVNShop() {
  const context = useContext(VNShopContext);
  if (!context) throw new Error("useVNShop must be used within VNShopProvider");
  return context;
}
