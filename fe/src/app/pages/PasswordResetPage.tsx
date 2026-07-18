import { KeyRound, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { requestPasswordReset } from "../lib/api/endpoints/auth";

/**
 * Native password-reset request page. Replaces the old "forgot password"
 * link that bounced users out to Keycloak's account console — Keycloak
 * chrome doesn't fit our brand and the redirect was the last seam where
 * KC hostnames leaked through to the buyer.
 *
 * The actual reset flow stays Keycloak-mediated: this page POSTs the email
 * to user-service /auth/password-reset-request, user-service asks Keycloak
 * to email an UPDATE_PASSWORD action token, and the buyer follows the
 * link from their inbox to KC's reset-credentials page. Hosting that
 * prompt natively too is a separate item — the email-and-redirect contract
 * is what KC's action-token system gives us out of the box.
 *
 * Always shows the generic success message regardless of whether the email
 * exists in the realm. The BE pattern matches: no enumeration of who
 * registered what.
 */
export function PasswordResetPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const controller = new AbortController();
    requestController.current = controller;
    void (async () => {
      try {
        await requestPasswordReset(email.trim(), controller.signal);
        setSubmitted(true);
      } catch {
        if (!controller.signal.aborted) setError(t("passwordReset.errorGeneric"));
      } finally {
        if (!controller.signal.aborted) setSubmitting(false);
      }
    })();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[420px] bg-card border border-border rounded-[var(--radius-xl)] p-10 text-center">
        {/* Icon circle */}
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-6">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("passwordReset.title", { defaultValue: "Reset your password" })}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("passwordReset.subtitle", {
            defaultValue:
              "Enter your email address and we'll send you a link to reset your password.",
          })}
        </p>

        {/* Success message — shown after submit */}
        {submitted ? (
          <div className="flex items-start gap-3 p-4 rounded-[var(--radius-lg)] bg-green-50 border border-green-200 text-sm text-green-800 text-left mb-6">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
            <div>
              <p className="font-medium">
                {t("passwordReset.successTitle", { defaultValue: "Email sent!" })}
              </p>
              <p className="mt-1 text-green-700">
                {t("passwordReset.successBody", {
                  defaultValue:
                    "Check your inbox for a reset link. It may take a few minutes to arrive.",
                })}
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="block text-[13px] font-medium text-foreground mb-1.5">
              {t("passwordReset.emailLabel", { defaultValue: "Email address" })}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("passwordReset.emailPlaceholder", { defaultValue: "your@email.com" })}
              aria-describedby={error ? "reset-error" : undefined}
              className="w-full py-3 px-3.5 border-[1.5px] border-border rounded-[var(--radius-lg)] text-sm bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-light)] transition-all"
            />
          </div>

          {error ? (
            <div
              id="reset-error"
              role="alert"
              className="flex items-start gap-2 p-3 rounded-[var(--radius-lg)] bg-red-50 border border-red-100 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || email.trim().length === 0}
            className="w-full py-3.5 rounded-[var(--radius-lg)] text-white font-bold text-[15px] bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? t("passwordReset.submitting", { defaultValue: "Sending..." })
              : t("passwordReset.submit", { defaultValue: "Send Reset Link" })}
          </button>
        </form>

        {/* Back to sign in */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {t("passwordReset.backToLogin", { defaultValue: "Back to Sign In" })}
          </Link>
        </div>
      </div>
    </div>
  );
}
