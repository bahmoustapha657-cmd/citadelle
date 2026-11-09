import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";

// Le français est dans le code de démarrage (langue par défaut et repli).
// L'anglais et l'arabe ne sont téléchargés et analysés que si on s'en sert :
// ils pesaient à eux deux près d'un tiers du code chargé à chaque ouverture.
const CHARGEURS = {
  en: () => import("./locales/en.json"),
  ar: () => import("./locales/ar.json"),
};

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
    resources: { fr: { translation: fr } },
    lng: "fr",
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

// Charge les textes d'une langue (une seule fois). false : fichier
// injoignable — sans réseau, pour une langue jamais ouverte sur l'appareil.
const chargements = new Map();
export function chargerLangue(code) {
  if (!CHARGEURS[code] || i18n.hasResourceBundle(code, "translation")) return Promise.resolve(true);
  if (!chargements.has(code)) {
    chargements.set(code, CHARGEURS[code]()
      .then((module) => {
        i18n.addResourceBundle(code, "translation", module.default ?? module, true, true);
        return true;
      })
      .catch(() => false)
      .finally(() => chargements.delete(code)));
  }
  return chargements.get(code);
}

// Passe l'application dans la langue `code`, une fois ses textes chargés.
// `memoriser` : choix de l'utilisateur, gardé pour les prochaines ouvertures.
// Renvoie false (langue inchangée) si les textes n'ont pas pu être chargés.
export async function changerLangue(code, { memoriser = true } = {}) {
  if (!SUPPORTED_LANGS.some((l) => l.code === code)) return false;
  if (!(await chargerLangue(code))) return false;
  await i18n.changeLanguage(code);
  if (memoriser) {
    try { localStorage.setItem("LC_lang", code); } catch { /* ignore */ }
  }
  return true;
}

// Langue choisie lors d'une ouverture précédente. main.jsx attend cette
// promesse (bornée) avant le premier affichage, pour ne pas montrer l'écran
// en français puis le retourner. En cas d'échec (hors ligne, fichier absent
// de l'appareil), l'application reste en français, le choix est gardé et
// l'on réessaie au retour du réseau.
const DELAI_LANGUE_INITIALE_MS = 4000;
export const languePrete = (() => {
  if (initialLang === "fr") return Promise.resolve();
  const chargement = changerLangue(initialLang, { memoriser: false }).then((ok) => {
    if (ok || typeof window === "undefined") return;
    window.addEventListener("online", function reessayer() {
      changerLangue(initialLang, { memoriser: false }).then((reussi) => {
        if (reussi) window.removeEventListener("online", reessayer);
      });
    });
  });
  return Promise.race([chargement, new Promise((fin) => { setTimeout(fin, DELAI_LANGUE_INITIALE_MS); })]);
})();

// Locale des dates et nombres affichés (toLocaleDateString…) selon la langue
// choisie. En arabe, chiffres latins : ceux des montants, des matricules et
// des documents de l'école.
export function localeCourante() {
  const lang = i18n.resolvedLanguage || i18n.language || "fr";
  if (lang.startsWith("ar")) return "ar-u-nu-latn";
  if (lang.startsWith("en")) return "en-GB";
  return "fr-FR";
}

// Le choix est mémorisé par changerLangue, pas ici : l'initialisation en
// français émet aussi cet événement et effacerait la langue choisie.
i18n.on("languageChanged", (lng) => {
  applyDocumentDirection(lng);
});

export default i18n;
