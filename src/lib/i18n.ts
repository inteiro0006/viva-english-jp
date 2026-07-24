import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en/common.json";
import ja from "@/locales/ja/common.json";

export const SUPPORTED_LANGUAGES = ["ja", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "ja";

let initialized = false;

export function initI18n() {
  if (initialized) return i18n;
  initialized = true;

  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        ja: { common: ja },
        en: { common: en },
      },
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      defaultNS: "common",
      ns: ["common"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        lookupLocalStorage: "app.lang",
        caches: ["localStorage"],
      },
      returnNull: false,
    });

  if (typeof document !== "undefined") {
    const applyLang = (lng: string) => {
      const short = lng.startsWith("ja") ? "ja" : "en";
      document.documentElement.setAttribute("lang", short);
    };
    applyLang(i18n.language || DEFAULT_LANGUAGE);
    i18n.on("languageChanged", applyLang);
  }

  return i18n;
}

export default i18n;
