import { RouterProvider } from "react-router";
import { Toaster } from "sonner";

import { ErrorBoundary } from "./components/error-boundary";
import { VNShopProvider } from "./components/vnshop-context";
import { useMessagingSocket } from "./hooks/use-messaging-socket";
import { useNotificationSocket } from "./hooks/use-notification-socket";
import { router } from "./routes";
import "../styles/fonts.css";

/**
 * Mounts background hooks that need access to the auth + query providers but
 * don't render anything. Lives inside `VNShopProvider` so it sees the same
 * QueryClient + AuthProvider as the routed pages.
 */
function BackgroundEffects() {
  useMessagingSocket();
  useNotificationSocket();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <VNShopProvider>
        <BackgroundEffects />
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          expand={false}
          toastOptions={{
            className: "!rounded-xl !shadow-lg !border !border-border !font-medium",
            style: { fontFamily: "'Be Vietnam Pro', sans-serif" },
            classNames: {
              info: "!bg-white dark:!bg-[#0F3460] !text-foreground !border-[#EE4D2D]/20",
              success:
                "!bg-white dark:!bg-[#0F3460] !text-foreground !border-green-200 dark:!border-green-800",
              error:
                "!bg-white dark:!bg-[#0F3460] !text-foreground !border-red-200 dark:!border-red-800",
              warning:
                "!bg-white dark:!bg-[#0F3460] !text-foreground !border-amber-200 dark:!border-amber-800",
              actionButton:
                "!bg-[#EE4D2D] !text-white !rounded-lg !font-semibold !text-xs !px-3 !py-1.5",
              cancelButton: "!bg-muted !text-muted-foreground !rounded-lg !font-medium !text-xs",
            },
          }}
        />
      </VNShopProvider>
    </ErrorBoundary>
  );
}
