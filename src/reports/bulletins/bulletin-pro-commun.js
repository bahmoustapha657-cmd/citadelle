// ══════════════════════════════════════════════════════════════
//  Bulletins « Officiel », « Prestige », « Contemporain » — briques communes
// ══════════════════════════════════════════════════════════════
// Formats (nombres à la française, rangs, dates), identité de l'école,
// photo, signatures et mentions de pied partagés par les trois gabarits.
// Les gabarits ne font que la mise en page.
import { getNationalDeviseHTML } from "../../national-symbols.js";
import { getOfficialLegalFooterHTML, legalProfileVide, mapNiveauToCycle, resolveLegalFields } from "../../legal-utils.js";
import { MINISTERE_DEFAUT, edugestBrandHTML, orDefault } from "../print-helpers.js";
import { blocsSignatures } from "../signatures.js";
import { PERIODE_ANNEE } from "./annual-notes.js";

export const echapper = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

// Nombre à la française (virgule décimale), « — » quand il manque.
export const nb = (v, decimales = 2) => (
  v == null || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(decimales).replace(".", ",")
);

const feminin = (sexe) => /^f/i.test(String(sexe || "").trim());

// Rang ordinal : 1er (1re pour une élève), puis 2e, 3e…
export const ordinal = (rang, sexe = "") => {
  if (rang == null) return "—";
  if (rang === 1) return `1<sup>${feminin(sexe) ? "re" : "er"}</sup>`;
  return `${rang}<sup>e</sup>`;
};

// Date de naissance : « 2013-03-12 » → « 12/03/2013 » ; tout autre format
// passe tel quel (saisies libres d'avant la migration).
export const dateFr = (d) => {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || "");
};

export const dateDuJour = () =>
  new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const PERIODES_LONGUES = {
  T1: "Premier trimestre", T2: "Deuxième trimestre", T3: "Troisième trimestre",
  S1: "Premier semestre", S2: "Second semestre",
};

// « Deuxième trimestre », « Mois d'octobre », « Fin d'année ».
export function libellePeriode(periode) {
  if (periode === PERIODE_ANNEE) return "Fin d'année";
  if (PERIODES_LONGUES[periode]) return PERIODES_LONGUES[periode];
  const mois = String(periode || "").trim().toLowerCase();
  if (!mois) return "";
  return `Mois ${/^[aeiouyéè]/.test(mois) ? "d'" : "de "}${mois}`;
}

// Étiquette courte d'une période (courbe, récapitulatif) : T1, S2, Oct.
export const periodeCourte = (periode) => (
  /^[TS]\d$/.test(periode) ? periode : String(periode || "").slice(0, 3)
);

// getMention écrit « Très Bien » : sur le papier, « Très bien ».
export const mentionFr = (mention) => (mention ? mention.charAt(0) + mention.slice(1).toLowerCase() : "");

export const titreBulletin =(periode) => (periode === PERIODE_ANNEE ? "Bulletin annuel" : "Bulletin de notes");

// Ce que l'en-tête imprime de l'école, déjà échappé.
export function identiteEcole(si = {}) {
  const lf = resolveLegalFields(si);
  const accueil = si.accueil || {};
  return {
    pays: echapper(orDefault(si.pays, "République de Guinée")),
    devise: getNationalDeviseHTML(si.pays),
    ministere: echapper(orDefault(lf.ministere, MINISTERE_DEFAUT)),
    tutelle: [lf.ire, lf.dpe].filter(Boolean).map(echapper).join(" · "),
    nom: echapper(si.nom || ""),
    agrement: lf.agrement ? `Agrément : ${echapper(lf.agrement)}` : "",
    adresse: echapper(accueil.adresse || si.ville || ""),
    contact: [accueil.telephone && `Tél. ${accueil.telephone}`, accueil.email].filter(Boolean).map(echapper).join(" · "),
    logo: si.logo || "",
    ville: echapper(si.ville || ""),
  };
}

export const logoHTML = (logo, mm) => (logo
  ? `<img crossOrigin="anonymous" src="${echapper(logo)}" alt="" style="width:${mm}mm;height:${mm}mm;object-fit:contain;display:block;margin:0 auto"/>`
  : "");

// Photo d'identité de l'élève ; sans photo, un cadre « PHOTO » où en coller une.
export const photoHTML = (eleve, { w, h, bord }) => (eleve.photo
  ? `<img crossOrigin="anonymous" src="${echapper(eleve.photo)}" alt="" style="width:${w}mm;height:${h}mm;object-fit:cover;display:block;margin:0 auto;border:.25mm solid ${bord}"/>`
  : `<div style="width:${w}mm;height:${h}mm;margin:0 auto;border:.25mm dashed ${bord};display:flex;align-items:center;justify-content:center;font:700 7px Arial;letter-spacing:.14em;color:#9aa3ad">PHOTO</div>`);

export const DISTINCTIONS = [
  { id: "felicitations", label: "Félicitations" },
  { id: "honneur", label: "Tableau d'honneur" },
  { id: "encouragements", label: "Encouragements" },
];
export const SANCTIONS = ["Avertissement (travail)", "Avertissement (conduite)", "Blâme"];
export const DECISIONS_FIN_ANNEE = ["Admis(e) en classe supérieure", "Redouble", "Non admis(e)"];
export const libelleDistinction = (id) => DISTINCTIONS.find((d) => d.id === id)?.label || "";

// Assiduité : un compteur connu, ou une ligne à remplir à la main.
export const compteur = (assiduite, cle) => (assiduite ? String(assiduite[cle]) : "……");

// Blocs de signature : parent, professeur principal, puis le ou les
// signataires de la matrice « Qui signe quoi » (chef de section par défaut).
// La signature scannée de l'école revient au signataire principal.
// `bloc({ titre, note, image })` fabrique un bloc dans le gabarit.
export function signaturesBulletin(schoolInfo, niveau, bloc) {
  return [
    bloc({ titre: "Le Parent / Tuteur", note: "Lu et approuvé" }),
    bloc({ titre: "Le Professeur principal", note: "Nom et signature" }),
    blocsSignatures(schoolInfo, "bulletin", (identite, s) => bloc({
      titre: identite,
      note: s.role === "principal" ? "Cachet et signature" : "Visa",
      image: s.role === "principal" && schoolInfo.signatureUrl ? schoolInfo.signatureUrl : "",
    }), { section: niveau }),
  ].join("");
}

export const imageSignature = (url) => (url
  ? `<img crossOrigin="anonymous" src="${echapper(url)}" alt="" style="display:block;height:12mm;max-width:90%;object-fit:contain;margin:1mm auto 0"/>`
  : "");

// Mentions de bas de page : n° du bulletin, exemplaire unique, arrêté
// d'ouverture (seulement s'il est renseigné), marque EduGest.
export function mentionsPied(schoolInfo, niveau, numero, avecQr) {
  const legal = getOfficialLegalFooterHTML(schoolInfo.legal || legalProfileVide, mapNiveauToCycle(niveau));
  return `Bulletin n° ${echapper(numero)} · délivré en un seul exemplaire, à conserver${avecQr ? " · authenticité vérifiable par le code QR" : ""}
    ${legal}${edugestBrandHTML(schoolInfo)}`;
}

// Le pied légal et la marque EduGest portent leurs propres marges : on les
// resserre dans le pied des nouveaux modèles.
export const PIED_CSS = `.pied .legal-footer{margin:0!important;padding:0!important;border:0!important;font-size:inherit!important}.pied>div:last-child{margin-top:.6mm!important}`;
