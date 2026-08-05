import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle, Save, Store } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import { registerSeller, sellerProfile } from "@/shared/api/endpoints/users";
import type { SellerProfile } from "@/shared/contracts/api";

import { useAuth } from "../hooks/auth-context";

interface SellerForm {
  shopName: string;
  bankName: string;
}

const EMPTY_FORM: SellerForm = { shopName: "", bankName: "" };

export function SellerRegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ready, authenticated, profile, roles, refresh } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState<SellerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof SellerForm, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [localApplication, setLocalApplication] = useState<SellerProfile | null>(null);
  const refreshAttemptedRef = useRef(false);

  const sellerApplicationQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    enabled: ready && authenticated,
    retry: false,
  });
  const application = localApplication ?? sellerApplicationQuery.data ?? null;
  const hasSellerRole = roles.includes("SELLER");

  useEffect(() => {
    if (!application?.approved || hasSellerRole || refreshAttemptedRef.current) return;
    refreshAttemptedRef.current = true;
    void refresh().catch(() => undefined);
  }, [application?.approved, hasSellerRole, refresh]);

  const registerMutation = useMutation({
    mutationFn: (input: SellerForm) =>
      registerSeller({ shopName: input.shopName.trim(), bankName: input.bankName.trim() }),
    onSuccess: (next) => {
      queryClient.setQueryData(["seller", "profile"], next);
      setLocalApplication(next);
      toast.success(t("sellerRegistration.successToast"));
    },
    onError: (error) => {
      setServerError(
        error instanceof ApiError && error.message
          ? error.message
          : t("sellerRegistration.errorGeneric"),
      );
    },
  });

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        {t("sellerRegistration.initSession")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="mb-3 text-xl font-bold text-foreground">
          {t("sellerRegistration.loginRequired")}
        </h1>
        <button
          type="button"
          onClick={() => void navigate("/login?next=%2Fseller%2Fregister")}
          className="rounded-[var(--radius-md)] bg-primary px-6 py-2.5 font-medium text-white"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  if (application) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => void navigate("/profile")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("sellerRegistration.backToProfile")}
        </button>

        <section className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {application.approved
              ? t("sellerRegistration.approvedTitle")
              : t("sellerRegistration.successTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {application.approved
              ? t("sellerRegistration.approvedBody")
              : t("sellerRegistration.successBody")}
          </p>

          <dl className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sellerRegistration.shopNameLabel")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{application.shopName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sellerRegistration.bankNameLabel")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {application.bankName ?? t("common.notProvided")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sellerRegistration.statusLabel")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-amber-700">
                {application.approved
                  ? t("sellerRegistration.approvedStatus")
                  : t("sellerRegistration.successStatus")}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              {application.approved
                ? t("sellerRegistration.approvedNotice")
                : t("sellerRegistration.pendingNotice")}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void navigate(application.approved && hasSellerRole ? "/seller" : "/profile")
            }
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {application.approved && hasSellerRole
              ? t("sellerRegistration.openSellerHub")
              : t("sellerRegistration.backToProfile")}
          </button>
        </section>
      </main>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (registerMutation.isPending) return;

    const nextErrors: Partial<Record<keyof SellerForm, string>> = {};
    const shopName = form.shopName.trim();
    const bankName = form.bankName.trim();
    if (!shopName) nextErrors.shopName = t("sellerRegistration.required");
    else if (shopName.length < 2) nextErrors.shopName = t("sellerRegistration.tooShort");
    if (!bankName) nextErrors.bankName = t("sellerRegistration.required");
    else if (bankName.length < 2) nextErrors.bankName = t("sellerRegistration.tooShort");

    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;

    registerMutation.mutate({ shopName, bankName });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => void navigate("/profile")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("sellerRegistration.backToProfile")}
      </button>

      <section className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
          <Store className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("sellerRegistration.title")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("sellerRegistration.subtitle")}
        </p>
        {profile?.email ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("sellerRegistration.account", { email: profile.email })}
          </p>
        ) : null}

        <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p>{t("sellerRegistration.reviewNotice")}</p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="seller-shop-name"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {t("sellerRegistration.shopNameLabel")}
            </label>
            <input
              id="seller-shop-name"
              name="shopName"
              type="text"
              autoComplete="organization"
              required
              minLength={2}
              maxLength={120}
              value={form.shopName}
              onChange={(event) =>
                setForm((current) => ({ ...current, shopName: event.target.value }))
              }
              aria-invalid={Boolean(errors.shopName)}
              aria-describedby={errors.shopName ? "seller-shop-name-error" : undefined}
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder={t("sellerRegistration.shopNamePlaceholder")}
            />
            {errors.shopName ? (
              <p id="seller-shop-name-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.shopName}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="seller-bank-name"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {t("sellerRegistration.bankNameLabel")}
            </label>
            <input
              id="seller-bank-name"
              name="bankName"
              type="text"
              autoComplete="organization"
              required
              minLength={2}
              maxLength={120}
              value={form.bankName}
              onChange={(event) =>
                setForm((current) => ({ ...current, bankName: event.target.value }))
              }
              aria-invalid={Boolean(errors.bankName)}
              aria-describedby={errors.bankName ? "seller-bank-name-error" : undefined}
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              placeholder={t("sellerRegistration.bankNamePlaceholder")}
            />
            {errors.bankName ? (
              <p id="seller-bank-name-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.bankName}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <p
              role="alert"
              className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {serverError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void navigate("/profile")}
              className="rounded-[var(--radius-md)] border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background"
            >
              {t("sellerRegistration.cancel")}
            </button>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {registerMutation.isPending
                ? t("sellerRegistration.submitting")
                : t("sellerRegistration.submit")}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
