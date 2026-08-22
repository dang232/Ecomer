import { createElement, lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";

import { PageSkeleton, ProductDetailSkeleton } from "@/shared/ui";

import { ErrorBoundary } from "./components/error-boundary";
import { orderDetailOptions } from "./hooks/use-orders";
import { productDetailOptions } from "./hooks/use-products";
import { sellerDetailOptions, sellerProductsOptions } from "./hooks/use-sellers";
import {
  AdminLayout,
  AuthLayout,
  SellerLayout,
  StandaloneLayout,
  StorefrontLayout,
} from "./layouts";
import { RequireAuth, RequireRole } from "./lib/auth/role-guard";
import { queryClient } from "./lib/query-client";
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
const SellerRegisterPage = lazy(() =>
  import("./pages/SellerRegisterPage").then((m) => ({ default: m.SellerRegisterPage })),
);
const WishlistPage = lazy(() =>
  import("./pages/WishlistPage").then((m) => ({ default: m.WishlistPage })),
);
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
const PublicSellersPage = lazy(() =>
  import("./pages/PublicSellersPage").then((m) => ({ default: m.PublicSellersPage })),
);
const PasswordResetPage = lazy(() =>
  import("./pages/PasswordResetPage").then((m) => ({ default: m.PasswordResetPage })),
);
const ReturnRequestPage = lazy(() =>
  import("./pages/ReturnRequestPage").then((m) => ({ default: m.ReturnRequestPageWrapper })),
);
const ReturnStatusPage = lazy(() =>
  import("./pages/ReturnStatusPage").then((m) => ({ default: m.ReturnStatusPageWrapper })),
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

const SellerDashboardRoute = lazy(() =>
  import("@/features/seller-dashboard").then((m) => ({ default: m.SellerDashboardRoute })),
);
const SellerProductsRoute = lazy(() =>
  import("./routes/seller-products-route").then((m) => ({ default: m.SellerProductsRoute })),
);
const SellerOrderQueueRoute = lazy(() =>
  import("@/features/seller-orders").then((m) => ({ default: m.SellerOrderQueueRoute })),
);
const ReturnsRoute = lazy(() =>
  import("@/features/seller-returns").then((m) => ({ default: m.ReturnsRoute })),
);
const SellerReviewInboxRoute = lazy(() =>
  import("@/features/seller-reviews").then((m) => ({ default: m.SellerReviewInboxRoute })),
);
const SellerWalletRoute = lazy(() =>
  import("./routes/seller-wallet-route").then((m) => ({ default: m.SellerWalletRoute })),
);
const SellerSettingsRoute = lazy(() =>
  import("./routes/seller-settings-route").then((m) => ({ default: m.SellerSettingsRoute })),
);

const AdminDashboard = lazy(() =>
  import("@/features/admin-dashboard").then((m) => ({ default: m.AdminDashboard })),
);
const AdminOrderQueue = lazy(() =>
  import("./routes/admin-orders-route").then((m) => ({ default: m.AdminOrderQueueRoute })),
);
const CouponList = lazy(() =>
  import("@/features/admin-coupons").then((m) => ({ default: m.CouponList })),
);
const SellerApprovalQueue = lazy(() =>
  import("./routes/admin-sellers-route").then((m) => ({
    default: m.AdminSellerApprovalQueueRoute,
  })),
);
const ReviewModerationQueue = lazy(() =>
  import("./routes/admin-reviews-route").then((m) => ({
    default: m.AdminReviewModerationQueueRoute,
  })),
);
const VideoModerationRoute = lazy(() =>
  import("./routes/video-moderation-route").then((m) => ({ default: m.VideoModerationRoute })),
);
const DisputeQueue = lazy(() =>
  import("./routes/admin-disputes-route").then((m) => ({ default: m.AdminDisputeQueueRoute })),
);
const PayoutQueue = lazy(() =>
  import("./routes/admin-payouts-route").then((m) => ({ default: m.AdminPayoutQueueRoute })),
);
const AdminUserQueue = lazy(() =>
  import("./routes/admin-users-route").then((m) => ({ default: m.AdminUserQueueRoute })),
);
const SystemHealth = lazy(() =>
  import("@/features/admin-health").then((m) => ({ default: m.SystemHealth })),
);

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
const guarded = (el: ReactNode) => createElement(RequireAuth, null, lazyRoute(el));
const guardedWithBoundary = (el: ReactNode) =>
  createElement(RequireAuth, null, suspenseWithBoundary(el));
const sellerOnly = (el: ReactNode) => createElement(RequireRole, { role: "SELLER" }, lazyRoute(el));
const adminOnly = (el: ReactNode) =>
  createElement(
    RequireRole,
    {
      role: "ADMIN",
      fallbackPath: "/access-denied",
    },
    lazyRoute(el),
  );

export const router = createBrowserRouter([
  {
    path: "/",
    Component: StorefrontLayout,
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
        path: "returns",
        element: guardedWithBoundary(createElement(ReturnStatusPage)),
      },
      {
        path: "returns/new",
        element: guardedWithBoundary(createElement(ReturnRequestPage)),
      },
      {
        path: "profile",
        element: guardedWithBoundary(createElement(ProfilePage)),
      },
      {
        path: "seller/register",
        element: guardedWithBoundary(createElement(SellerRegisterPage)),
      },
      { path: "wishlist", element: guardedWithBoundary(createElement(WishlistPage)) },
      { path: "design-system", element: lazyRoute(createElement(DesignSystemPage)) },
      { path: "messages", element: guardedWithBoundary(createElement(MessagesPage)) },
      { path: "notifications", element: guarded(createElement(NotificationsPage)) },
      {
        path: "notifications/preferences",
        element: guarded(createElement(NotificationPreferencesPage)),
      },
      {
        path: "sellers",
        element: suspenseWithBoundary(createElement(PublicSellersPage)),
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
  {
    Component: AuthLayout,
    children: [
      { path: "/login", element: lazyRoute(createElement(LoginPage)) },
      { path: "/register", element: lazyRoute(createElement(RegisterPage)) },
      { path: "/password-reset", element: lazyRoute(createElement(PasswordResetPage)) },
      { path: "/access-denied", element: lazyRoute(createElement(AccessDeniedPage)) },
    ],
  },
  {
    path: "/seller",
    element: sellerOnly(createElement(SellerLayout)),
    children: [
      { index: true, element: lazyRoute(createElement(SellerDashboardRoute)) },
      { path: "products", element: lazyRoute(createElement(SellerProductsRoute)) },
      { path: "orders", element: lazyRoute(createElement(SellerOrderQueueRoute)) },
      { path: "returns", element: lazyRoute(createElement(ReturnsRoute)) },
      { path: "reviews", element: lazyRoute(createElement(SellerReviewInboxRoute)) },
      { path: "wallet", element: lazyRoute(createElement(SellerWalletRoute)) },
      { path: "settings", element: lazyRoute(createElement(SellerSettingsRoute)) },
    ],
  },
  {
    path: "/admin",
    element: adminOnly(createElement(AdminLayout)),
    children: [
      { index: true, element: lazyRoute(createElement(AdminDashboard)) },
      { path: "orders", element: lazyRoute(createElement(AdminOrderQueue)) },
      { path: "coupons", element: lazyRoute(createElement(CouponList)) },
      { path: "sellers", element: lazyRoute(createElement(SellerApprovalQueue)) },
      { path: "reviews", element: lazyRoute(createElement(ReviewModerationQueue)) },
      { path: "video", element: lazyRoute(createElement(VideoModerationRoute)) },
      { path: "disputes", element: lazyRoute(createElement(DisputeQueue)) },
      { path: "payouts", element: lazyRoute(createElement(PayoutQueue)) },
      { path: "users", element: lazyRoute(createElement(AdminUserQueue)) },
      { path: "health", element: lazyRoute(createElement(SystemHealth)) },
    ],
  },
  {
    Component: StandaloneLayout,
    children: [
      {
        path: "/payment/return/:provider",
        element: lazyRoute(createElement(PaymentReturnPage)),
      },
    ],
  },
]);
