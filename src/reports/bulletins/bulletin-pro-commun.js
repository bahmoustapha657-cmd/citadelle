// ══════════════════════════════════════════════════════════════
//  Bulletins « Officiel », « Prestige », « Contemporain » — briques communes
// ══════════════════════════════════════════════════════════════
// Formats (nombres à la française, rangs, dates), identité de l'école,
// photo, signatures et mentions de pied partagés par les trois gabarits.
// Les gabarits ne font que la mise en page.
import { getNationalDeviseHTML } from "../../national-symbols.js";
import { getOfficialLegalFooterHTML, legalProfileVide, mapNiveauToCycle, resolveLegalFields } from "../../legal-utils.js";
import { MINISTERE_DEFAUT, edugestBrandHTML, orDefault } from "../print-helpers.js";
import { blocsSignatures, imagesSignataire } from "../signatures.js";
import { normaliserDecalageCachet, normaliserTailleCachet } from "../signataire-session.js";
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

// Le primaire (préscolaire compris, rattaché à la Direction du primaire) a un
// maître titulaire par classe ; le collège et le lycée, un professeur principal.
const SECTIONS_PRIMAIRE = new Set(["prescolaire", "maternelle", "primaire"]);
export const sectionPrimaire = (niveau) => SECTIONS_PRIMAIRE.has(String(niveau || "").toLowerCase());

// Blocs de signature : l'enseignant titulaire de la classe (maître titulaire
// au primaire, professeur principal au secondaire), puis le ou les
// signataires de la matrice « Qui signe quoi » (chef de section par défaut).
// Le parent ou tuteur ne signe pas le bulletin : c'est un document de
// l'école, signé par ceux qui l'établissent.
// Le cachet et/ou la signature personnels du chef de section, quand c'est lui
// qui imprime ; à défaut, la signature scannée de l'école revient au
// signataire principal.
// `bloc({ titre, note, image, images, cachet })` fabrique un bloc dans le
// gabarit ; `images` : [{ url, taille, decalage }] à rendre avec
// imagesSignature (taille et position réglées par leur titulaire ; 1 et
// centrée pour la signature de l'école), `image` : la première, ou "" ;
// `cachet` marque le signataire principal, qui appose le cachet de l'école
// (Prestige lui réserve une place quand aucune image ne s'imprime).
export function signaturesBulletin(schoolInfo, niveau, bloc) {
  return [
    bloc({ titre: sectionPrimaire(niveau) ? "Le Maître titulaire" : "Le Professeur principal", note: "Nom et signature", images: [] }),
    blocsSignatures(schoolInfo, "bulletin", (identite, s) => {
      const personnelles = imagesSignataire(s);
      const images = personnelles.length ? personnelles
        : s.role === "principal" && schoolInfo.signatureUrl ? [{ url: schoolInfo.signatureUrl, taille: 1, decalage: null }] : [];
      return bloc({
        titre: identite,
        note: s.role === "principal" ? "Cachet et signature" : "Visa",
        image: images[0]?.url || "",
        images,
        cachet: s.role === "principal",
      });
    }, { section: niveau }),
  ].join("");
}

// Image de signature (12 mm). `taille` ≠ 1 : plus grande ou plus petite, mais
// la place qu'elle occupe reste celle de 12 mm — le surplus déborde à moitié
// au-dessus, à moitié en dessous, et le bulletin garde sa page unique.
// `decalage` { x, y } : position réglée par le titulaire, en fraction de la
// hauteur de l'image — simple déplacement, la place occupée ne change pas.
function geometrieImage(taille, decalage) {
  const t = normaliserTailleCachet(taille);
  const debord = (t - 1) * 6; // mm de chaque côté (négatif si plus petite)
  const hauteur = Math.round(120 * t) / 10;
  const { x, y } = normaliserDecalageCachet(decalage);
  const mm = (f) => `${Math.round(hauteur * f * 10) / 10}mm`;
  return {
    hauteur,
    haut: t === 1 ? "1mm" : `${(1 - debord).toFixed(1)}mm`,
    marges: t === 1 ? "1mm auto 0" : `${(1 - debord).toFixed(1)}mm auto ${(-debord).toFixed(1)}mm`,
    deplacement: x || y ? `;transform:translate(${mm(x)}, ${mm(y)})` : "",
  };
}

export const imageSignature = (url, taille = 1, decalage = null) => {
  if (!url) return "";
  const g = geometrieImage(taille, decalage);
  return `<img crossOrigin="anonymous" src="${echapper(url)}" alt="" style="display:block;height:${g.hauteur}mm;max-width:90%;object-fit:contain;margin:${g.marges};mix-blend-mode:multiply${g.deplacement}"/>`;
};

// Images d'un bloc (`images` de signaturesBulletin). Le cachet ET la
// signature : chacun à sa taille et à sa position, dans les mêmes 13 mm.
export const imagesSignature = (images = []) => {
  if (images.length < 2) return images[0] ? imageSignature(images[0].url, images[0].taille, images[0].decalage) : "";
  const calques = images.map(({ url, taille, decalage }) => {
    const g = geometrieImage(taille, decalage);
    return `<img crossOrigin="anonymous" src="${echapper(url)}" alt="" style="position:absolute;left:0;right:0;top:${g.haut};height:${g.hauteur}mm;max-width:90%;object-fit:contain;margin:0 auto;mix-blend-mode:multiply${g.deplacement}"/>`;
  });
  return `<div style="position:relative;height:13mm">${calques.join("")}</div>`;
};

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
