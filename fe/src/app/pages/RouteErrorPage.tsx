import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { Button } from "../../shared/ui/button";

const CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror/i;
const RECOVERY_KEY = "vnshop:chunk-recovery-at";
const RECOVERY_WINDOW_MS = 30_000;

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim();
  if (error instanceof Error) return error.message;
  return "";
}

function isChunkLoadError(error: unknown): boolean {
  return CHUNK_ERROR_PATTERN.test(errorMessage(error));
}

function attemptChunkRecovery(): void {
  try {
    const previousAttempt = Number(sessionStorage.getItem(RECOVERY_KEY));
    if (Number.isFinite(previousAttempt) && Date.now() - previousAttempt < RECOVERY_WINDOW_MS) {
      return;
    }
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    window.location.reload();
  } catch {
    // Private browsing can deny sessionStorage. The manual reload remains available.
  }
}

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) attemptChunkRecovery();
  }, [chunkError]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12" role="alert">
      <section className="w-full max-w-lg rounded-[var(--radius-card)] border border-border bg-card p-6 text-center shadow-[var(--shadow-medium)] sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-error-light text-error">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {chunkError ? t("routeError.chunkTitle") : t("routeError.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {chunkError ? t("routeError.chunkDescription") : t("routeError.description")}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("routeError.reload")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void navigate("/")}>
            <Home className="h-4 w-4" aria-hidden="true" />
            {t("routeError.home")}
          </Button>
        </div>
      </section>
    </main>
  );
}
