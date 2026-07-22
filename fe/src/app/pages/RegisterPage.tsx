import type { CountryCode } from "libphonenumber-js";
import { Sparkles, Eye, EyeOff, ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import {
  CountryPhoneInput,
  DEFAULT_COUNTRY,
  parseOptionalPhone,
} from "../components/form/CountryPhoneInput";
import { FormField } from "../components/form/FormField";
import { useAuth } from "../hooks/use-auth";
import { sanitizeRedirect } from "../lib/auth/sanitize-redirect";
import { isValidEmail } from "../lib/validation/email";
import { MIN_PASSWORD_LENGTH } from "../lib/validation/password";

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { ready, authenticated, register, loginWithPassword } = useAuth();
  const { t } = useTranslation();
  const next = sanitizeRedirect(params.get("next"));

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  if (ready && authenticated) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setErrors({});
    setServerError(null);

    const validationErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      validationErrors.firstName = t("register.form.errorFirstNameRequired");
    }
    if (!lastName.trim()) {
      validationErrors.lastName = t("register.form.errorLastNameRequired");
    }
    if (!isValidEmail(email)) {
      validationErrors.email = t("register.form.errorEmailInvalid");
    }
    // Optional field — only validate when the user actually typed something.
    // Empty/blank means "no phone", which the BE accepts. CountryPhoneInput
    // already shows a live error while typing; this branch only fires if the
    // user bypasses the input (e.g. devtools).
    if (phone.trim() !== "" && parseOptionalPhone(phone, phoneCountry) === null) {
      validationErrors.phone = t("register.form.errorPhoneInvalid");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      validationErrors.password = t("register.form.errorPasswordShort");
    }
    if (password !== confirm) {
      validationErrors.confirm = t("register.form.errorMismatch");
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        await register({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          // parseOptionalPhone centralises the null/blank/invalid → null rule
          // and formats to E.164 with the active country's dial code, so the
          // BE never receives a non-E.164 string.
          phone: parseOptionalPhone(phone, phoneCountry) ?? undefined,
        });
        await loginWithPassword(email.trim(), password);
        void navigate(next, { replace: true });
      } catch (err) {
        const errorCode =
          err && typeof err === "object" && "errorCode" in err
            ? (err as { errorCode?: unknown }).errorCode
            : undefined;
        const message =
          err && typeof err === "object" && "message" in err
            ? (err as { message?: unknown }).message
            : undefined;
        if (errorCode === "email_taken") {
          setServerError(t("register.form.errorEmailTaken"));
        } else if (errorCode === "weak_password") {
          setServerError(t("register.form.errorWeakPassword"));
        } else if (
          errorCode === "validation_error" &&
          typeof message === "string" &&
          /phone/i.test(message)
        ) {
          // BE rejected the phone — surface as a field error, not a banner.
          setErrors({ phone: t("register.form.errorPhoneInvalid") });
        } else if (typeof message === "string" && message) {
          setServerError(message);
        } else {
          setServerError(t("register.form.errorGeneric"));
        }
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[480px] bg-card border border-border rounded-[var(--radius-xl)] p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-primary flex items-center justify-center text-primary-foreground">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-foreground">VNShop</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t("register.title", { defaultValue: "Create your account" })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("register.subtitle", { defaultValue: "Join millions of buyers and sellers today" })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* First name + Last name side by side */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="firstName"
              type="text"
              autoComplete="given-name"
              required
              label={t("register.form.firstNameLabel", { defaultValue: "First Name" })}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={errors.firstName}
            />
            <FormField
              id="lastName"
              type="text"
              autoComplete="family-name"
              required
              label={t("register.form.lastNameLabel", { defaultValue: "Last Name" })}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={errors.lastName}
            />
          </div>

          <FormField
            id="email"
            type="email"
            autoComplete="email"
            required
            label={t("register.form.emailLabel", { defaultValue: "Email" })}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <CountryPhoneInput
            value={phone}
            country={phoneCountry}
            onChange={setPhone}
            onCountryChange={setPhoneCountry}
            label={t("register.form.phoneLabel", { defaultValue: "Phone Number" })}
            helperText={t("register.form.phoneHelper", {
              defaultValue: "Select your country and enter your number",
            })}
            error={errors.phone}
            id="phone"
          />

          {/* Password has a focus-driven hint and an eye toggle, so it
              doesn't fit the plain FormField API — but it reuses the same
              label/input/error pattern. */}
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-[13px] font-medium text-foreground mb-1.5"
            >
              {t("register.form.passwordLabel", { defaultValue: "Password" })}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                placeholder={t("register.form.passwordHint", {
                  defaultValue: "At least 8 characters",
                })}
                aria-describedby={errors.password ? "register-error-password" : undefined}
                className={`w-full py-3 px-3.5 pr-11 border-[1.5px] rounded-[var(--radius-lg)] text-sm bg-card text-foreground placeholder:text-muted-foreground outline-none transition-all ${
                  errors.password
                    ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
                    : "border-border focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-light)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password ? (
              <p
                id="register-error-password"
                role="alert"
                className="flex items-center gap-1 mt-1.5 text-xs text-red-600"
              >
                <span>{errors.password}</span>
              </p>
            ) : pwFocused ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("register.form.passwordHint", { defaultValue: "At least 8 characters" })}
              </p>
            ) : null}
          </div>

          <FormField
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            label={t("register.form.confirmLabel", { defaultValue: "Confirm Password" })}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />

          {/* Server Error */}
          {serverError ? (
            <div
              id="register-error"
              role="alert"
              className="flex items-start gap-2 p-3 rounded-[var(--radius-lg)] bg-red-50 border border-red-100 text-sm text-red-700"
            >
              <span>{serverError}</span>
            </div>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={!ready || submitting}
            className="w-full py-3.5 rounded-[var(--radius-lg)] text-white font-bold text-[15px] bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {t("register.form.submitting", { defaultValue: "Creating account..." })}
              </>
            ) : (
              <>
                {t("register.form.submit", { defaultValue: "Create Account" })}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Terms */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("login.termsNotice", {
            defaultValue:
              "By creating an account you agree to our Terms of Service and Privacy Policy.",
          })}
        </p>

        {/* Login link */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("register.haveAccount", { defaultValue: "Already have an account?" })}{" "}
          <button
            type="button"
            onClick={() => void navigate(`/login?next=${encodeURIComponent(next)}`)}
            className="font-medium text-primary hover:underline"
          >
            {t("register.signIn", { defaultValue: "Sign in" })}
          </button>
        </p>
      </div>
    </div>
  );
}
