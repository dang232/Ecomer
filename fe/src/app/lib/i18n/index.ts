import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import vi from "./vi.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    fallbackLng: "vi",
    supportedLngs: ["vi", "en"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

function syncDocumentLanguage() {
  const language = i18n.resolvedLanguage ?? i18n.language;
  if (language) {
    document.documentElement.lang = language;
  }
}

syncDocumentLanguage();
i18n.on("languageChanged", syncDocumentLanguage);

export default i18n;
