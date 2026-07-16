import { ArrowLeft, Home, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <ShieldAlert size={32} />
      </div>

      <p className="mb-3 text-[72px] font-extrabold leading-none text-primary/20 select-none">
        403
      </p>

      <h1 className="mb-3 text-2xl font-bold text-foreground">
        {t("auth.forbiddenTitle", "Access denied")}
      </h1>

      <p className="mb-8 max-w-[440px] text-sm text-text-secondary">
        {t(
          "auth.forbiddenDescription",
          "You do not have permission to view this page. Please return to the storefront or sign in with an authorized account.",
        )}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-transparent px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-background"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t("auth.forbiddenBack", "Go back")}
        </button>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Home size={16} aria-hidden="true" />
          {t("auth.forbiddenHome", "Back to home")}
        </button>
      </div>
    </div>
  );
}
