import { useTranslation } from "react-i18next";

const SUPPORTED = ["vi", "en"] as const;
type SupportedLang = (typeof SUPPORTED)[number];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (
    SUPPORTED.includes(i18n.resolvedLanguage as SupportedLang) ? i18n.resolvedLanguage : "vi"
  ) as SupportedLang;
  const next: SupportedLang = current === "vi" ? "en" : "vi";

  return (
    <button
      type="button"
      onClick={() => {
        void i18n.changeLanguage(next);
      }}
      className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-semibold tracking-wide"
      title={next === "vi" ? "Tiếng Việt" : "English"}
      aria-label={`Switch language to ${next.toUpperCase()}`}
    >
      {t(`language.${current}`)}
    </button>
  );
}
