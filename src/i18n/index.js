import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGS = [
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "en", label: "English",  flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية",  flag: "🇸🇦", dir: "rtl" },
];

const RTL_LANGS = SUPPORTED_LANGS.filter((l) => l.dir === "rtl").map((l) => l.code);

export function applyDocumentDirection(lang) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.lang = lang;
  html.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
}

const stored = (typeof localStorage !== "undefined" && localStorage.getItem("LC_lang")) || null;
const initialLang = SUPPORTED_LANGS.find((l) => l.code === stored)?.code || "fr";

i18n
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en }, ar: { translation: ar } },
    lng: initialLang,
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

applyDocumentDirection(initialLang);

i18n.on("languageChanged", (lng) => {
  applyDocumentDirection(lng);
  try { localStorage.setItem("LC_lang", lng); } catch { /* ignore */ }
});

export default i18n;
