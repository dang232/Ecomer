import { Home, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <p
        className="text-[96px] font-extrabold text-primary opacity-20 leading-none mb-4 select-none"
        aria-hidden="true"
      >
        404
      </p>

      <h1 className="text-2xl font-bold text-foreground mb-3">
        {t("notFound.title", "Page not found")}
      </h1>

      <p className="text-sm text-text-secondary max-w-[400px] mb-8">
        {t(
          "notFound.description",
          "The page you're looking for doesn't exist or has been moved. Let's get you back on track.",
        )}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-6 py-3 rounded-[var(--radius-lg)] text-sm font-semibold bg-primary text-white hover:opacity-90 transition-opacity"
        >
          <Home size={16} aria-hidden="true" />
          {t("notFound.goHome", "Back to Home")}
        </button>

        <button
          type="button"
          onClick={() => navigate("/search")}
          className="flex items-center gap-2 px-6 py-3 rounded-[var(--radius-lg)] text-sm font-semibold border border-border bg-transparent text-foreground hover:bg-background transition-colors"
        >
          <Search size={16} aria-hidden="true" />
          {t("notFound.search", "Search Products")}
        </button>
      </div>
    </div>
  );
}
