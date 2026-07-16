import { Component, type ErrorInfo, type ReactNode } from "react";

import { ApiError } from "../lib/api";
import i18n from "../lib/i18n";

interface Props {
  children: ReactNode;
  fallback?: (error: unknown, reset: () => void) => ReactNode;
}

interface State {
  error: unknown;
  retryCount: number;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryCount: 0, isRetrying: false };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error, isRetrying: false };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    // If a new, different error arrives, reset the retry counter.
    if (this.state.error && prevState.error && this.state.error !== prevState.error) {
      this.setState({ retryCount: 0 });
    }
  }

  reset = () => this.setState({ error: null, isRetrying: false });

  handleRetry = () => {
    const { retryCount } = this.state;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
    this.setState({ isRetrying: true });
    setTimeout(() => {
      this.setState({ error: null, retryCount: retryCount + 1, isRetrying: false });
    }, delay);
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);

    const { retryCount, isRetrying } = this.state;
    const apiError = this.state.error instanceof ApiError ? this.state.error : null;
    const message =
      apiError?.message ??
      (this.state.error instanceof Error
        ? this.state.error.message
        : i18n.t("errorBoundary.description", { defaultValue: "An unknown error occurred." }));

    const isPermanent = retryCount >= 3;

    return (
      <div role="alert" className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-foreground mb-2">
            {i18n.t("errorBoundary.title", { defaultValue: "Something went wrong" })}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          {apiError?.correlationId ? (
            <p className="text-xs text-muted-foreground mb-4">
              {i18n.t("errorBoundary.supportCode", { defaultValue: "Support code" })}:{" "}
              <span className="font-mono">{apiError.correlationId}</span>
            </p>
          ) : null}
          {isPermanent ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: "var(--primary)" }}
            >
              {i18n.t("errorBoundary.reload", { defaultValue: "Reload page" })}
            </button>
          ) : (
            <button
              type="button"
              onClick={this.handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              {isRetrying
                ? i18n.t("errorBoundary.retrying", { defaultValue: "Retrying…" })
                : i18n.t("errorBoundary.retry", { defaultValue: "Try again" })}
            </button>
          )}
        </div>
      </div>
    );
  }
}
