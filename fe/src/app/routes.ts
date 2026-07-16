import { createElement, lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";

import { ErrorBoundary } from "./components/error-boundary";
import { PageSkeleton, ProductDetailSkeleton } from "./components/ui/page-skeleton";
import { myOrdersOptions, orderDetailOptions } from "./hooks/use-orders";
import { productDetailOptions } from "./hooks/use-products";
import { profileOptions } from "./hooks/use-profile";
import { sellerDetailOptions, sellerProductsOptions } from "./hooks/use-sellers";
import { RequireAuth, RequireRole } from "./lib/auth/role-guard";
import { queryClient } from "./lib/query-client";
import { Root } from "./pages/Root";
import { RouteErrorPage } from "./pages/RouteErrorPage";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);

const SearchPage = lazy(() =>
  import("./pages/SearchPage").then((m) => ({ default: m.SearchPage })),
);
const ProductPage = lazy(() =>
  import("./pages/ProductPage").then((m) => ({ default: m.ProductPage })),
);
const CartPage = lazy(() => import("./pages/CartPage").then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() =>
  import("./pages/checkout").then((m) => ({ default: m.CheckoutPage })),
);
const OrdersPage = lazy(() =>
  import("./pages/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import("./pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const WishlistPage = lazy(() =>
  import("./pages/WishlistPage").then((m) => ({ default: m.WishlistPage })),
);
const SellerPage = lazy(() => import("./pages/seller").then((m) => ({ default: m.SellerPage })));
const AdminPage = lazy(() => import("./pages/admin").then((m) => ({ default: m.AdminPage })));
const DesignSystemPage = lazy(() =>
  import("./pages/DesignSystemPage").then((m) => ({ default: m.DesignSystemPage })),
);
const PaymentReturnPage = lazy(() =>
  import("./pages/PaymentReturnPage").then((m) => ({ default: m.PaymentReturnPage })),
);
const MessagesPage = lazy(() =>
  import("./pages/MessagesPage").then((m) => ({ default: m.MessagesPage })),
);
const SellerDetailPage = lazy(() =>
  import("./pages/SellerDetailPage").then((m) => ({ default: m.SellerDetailPage })),
);
const PasswordResetPage = lazy(() =>
  import("./pages/PasswordResetPage").then((m) => ({ default: m.PasswordResetPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((m) => ({ default: m.NotificationsPageRoute })),
);
const NotificationPreferencesPage = lazy(() =>
  import("./components/notifications/notification-preferences-page").then((m) => ({
    default: m.NotificationPreferencesPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
const AccessDeniedPage = lazy(() =>
  import("./pages/AccessDeniedPage").then((m) => ({ default: m.AccessDeniedPage })),
);

/* eslint-disable react/no-children-prop -- createElement passes children via props by design */
const lazyRoute = (el: ReactNode) =>
  createElement(Suspense, { fallback: createElement(PageSkeleton) }, el);
const suspenseWithBoundary = (el: ReactNode) =>
  createElement(
    ErrorBoundary,
    null,
    createElement(Suspense, { fallback: createElement(PageSkeleton) }, el),
  );
const suspenseWithDetailBoundary = (el: ReactNode) =>
  createElement(
    ErrorBoundary,
    null,
    createElement(Suspense, { fallback: createElement(ProductDetailSkeleton) }, el),
  );
const guarded = (el: ReactNode) => createElement(RequireAuth, { children: lazyRoute(el) });
const guardedWithBoundary = (el: ReactNode) =>
  createElement(RequireAuth, { children: suspenseWithBoundary(el) });
const sellerOnly = (el: ReactNode) =>
  createElement(RequireRole, { role: "SELLER", children: lazyRoute(el) });
const adminOnly = (el: ReactNode) =>
  createElement(RequireRole, {
    role: "ADMIN",
    fallbackPath: "/access-denied",
    children: lazyRoute(el),
  });
/* eslint-enable react/no-children-prop */

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    errorElement: createElement(RouteErrorPage),
    children: [
      { index: true, element: lazyRoute(createElement(HomePage)) },
      { path: "search", element: suspenseWithBoundary(createElement(SearchPage)) },
      {
        path: "product/:id",
        element: suspenseWithDetailBoundary(createElement(ProductPage)),
        loader: ({ params }) => {
          const id = params.id ?? "";
          // Prefetch in parallel — loader doesn't block render, just primes the cache.
          void queryClient.prefetchQuery(productDetailOptions(id));
          return null;
        },
      },
      { path: "cart", element: suspenseWithBoundary(createElement(CartPage)) },
      { path: "checkout", element: guarded(createElement(CheckoutPage)) },
      {
        path: "orders",
        element: guardedWithBoundary(createElement(OrdersPage)),
        loader: () => {
          void queryClient.prefetchQuery(myOrdersOptions());
          return null;
        },
      },
      {
        path: "orders/:id",
        element: guardedWithBoundary(createElement(OrderDetailPage)),
        loader: ({ params }) => {
          void queryClient.prefetchQuery(orderDetailOptions(params.id));
          return null;
        },
      },
      {
        path: "profile",
        element: guardedWithBoundary(createElement(ProfilePage)),
        loader: () => {
          void queryClient.prefetchQuery(profileOptions());
          return null;
        },
      },
      { path: "wishlist", element: guardedWithBoundary(createElement(WishlistPage)) },
      { path: "login", element: lazyRoute(createElement(LoginPage)) },
      { path: "register", element: lazyRoute(createElement(RegisterPage)) },
      { path: "password-reset", element: lazyRoute(createElement(PasswordResetPage)) },
      { path: "access-denied", element: lazyRoute(createElement(AccessDeniedPage)) },
      { path: "seller/*", element: sellerOnly(createElement(SellerPage)) },
      { path: "admin/*", element: adminOnly(createElement(AdminPage)) },
      { path: "design-system", element: lazyRoute(createElement(DesignSystemPage)) },
      { path: "payment/return/:provider", element: lazyRoute(createElement(PaymentReturnPage)) },
      { path: "messages", element: guardedWithBoundary(createElement(MessagesPage)) },
      { path: "notifications", element: guarded(createElement(NotificationsPage)) },
      {
        path: "notifications/preferences",
        element: guarded(createElement(NotificationPreferencesPage)),
      },
      {
        path: "sellers/:id",
        element: suspenseWithDetailBoundary(createElement(SellerDetailPage)),
        loader: ({ params }) => {
          const id = params.id ?? "";
          void queryClient.prefetchQuery(sellerDetailOptions(id));
          void queryClient.prefetchQuery(sellerProductsOptions(id));
          return null;
        },
      },
      { path: "*", element: lazyRoute(createElement(NotFoundPage)) },
    ],
  },
]);
