import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function ConsoleLayoutFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-12 border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
        <span>{t("footer.copyright")}</span>
        <Link to="/" className="transition-colors hover:text-foreground">
          {t("consoleChrome.backToStorefront")} -&gt;
        </Link>
      </div>
    </footer>
  );
}
