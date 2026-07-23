import { AlertCircle, ArrowRight, LockKeyhole, Store } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { useAppConfig } from "../hooks/use-app-config";
import { useAuth } from "../hooks/use-auth";
import { resolvePostLoginRedirect, sanitizeRedirect } from "../lib/auth/sanitize-redirect";

const OAUTH_ERROR_KEYS: Record<string, string> = {
  oauth_failed: "login.oauth.errorFailed",
  invalid_state: "login.oauth.errorInvalidState",
  exchange_failed: "login.oauth.errorExchange",
};

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const config = useAppConfig();
  const { ready, authenticated, roles, loginWithPassword, beginOAuthLogin } = useAuth();
  const { t } = useTranslation();
  const rawNext = params.get("next");
  const next = sanitizeRedirect(rawNext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    void (async () => {
      try {
        await loginWithPassword(username.trim(), password);
      } catch (loginError) {
        setError(
          loginError instanceof Error
            ? loginError.message
            : t("login.form.errorGeneric", {
                defaultValue: "Sign-in could not be completed. Please try again.",
              }),
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  useEffect(() => {
    const errorCode = params.get("oauthError");
    if (!errorCode) return;
    setError(
      t(OAUTH_ERROR_KEYS[errorCode] ?? "login.oauth.errorGeneric", {
        defaultValue: "Sign-in could not be completed. Please try again.",
      }),
    );
    const cleanParams = new URLSearchParams(params);
    cleanParams.delete("oauthError");
    const query = cleanParams.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [params, t]);

  if (ready && authenticated) {
    return <Navigate to={resolvePostLoginRedirect(rawNext, roles)} replace />;
  }

  const socialLogin = (provider: "google" | "facebook") => {
    if (!config.auth.oauthProviders.includes(provider)) {
      setError(
        t("login.oauth.errorUnavailable", {
          defaultValue: `${provider} login is currently unavailable`,
        }),
      );
      return;
    }
    beginOAuthLogin(provider, next);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-lg)] bg-primary text-primary-foreground">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xl font-bold">VNShop</p>
            <p className="text-xs text-muted-foreground">Marketplace account</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold">
          {t("login.title", { defaultValue: "Sign in to your account" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("login.subtitle", { defaultValue: "Continue with your VNShop identity" })}
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm font-medium" htmlFor="username">
            {t("login.form.username", { defaultValue: "Email or username" })}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-[var(--radius-lg)] border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <label className="block text-sm font-medium" htmlFor="password">
            {t("login.form.password", { defaultValue: "Password" })}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-[var(--radius-lg)] border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!ready || submitting || !username.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {submitting
              ? t("login.form.submitting", { defaultValue: "Signing in..." })
              : t("login.form.submit", { defaultValue: "Sign in" })}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["google", "facebook"] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => socialLogin(provider)}
              disabled={!config.auth.oauthProviders.includes(provider)}
              className="rounded-[var(--radius-lg)] border border-border px-3 py-2.5 text-sm font-semibold capitalize transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {provider}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => navigate("/password-reset")}
          >
            {t("login.form.forgot", { defaultValue: "Forgot password?" })}
          </button>
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(`/register?next=${encodeURIComponent(next)}`)}
          >
            {t("login.form.signUp", { defaultValue: "Create account" })}
          </button>
        </div>
      </section>
    </main>
  );
}
