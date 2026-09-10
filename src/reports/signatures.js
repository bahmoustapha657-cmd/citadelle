// ══════════════════════════════════════════════════════════════
//  Qui signe quoi — matrice des signatures des documents imprimés
// ══════════════════════════════════════════════════════════════
// Chaque document demandait son signataire en dur : « comptable » pour les
// reçus, « direction » pour le livret… Une école ne pouvait ni confier ses
// bulletins au Censeur, ni faire signer un poste qu'elle avait créé — ce
// poste et son responsable n'apparaissaient sur aucun papier, alors que
// Comptes & Postes promettait l'inverse.
//
// La matrice vit dans ecoles.extra.signatures (réglée dans Comptes & Postes) :
//   { [typeDocument]: { principal: <poste>, visa: <poste> | null } }
// <poste> est la clé d'un poste de l'école, ou SECTION : « le chef de la
// section de l'élève » (Direction primaire / Bureau collège), repli direction.
//
// Seules les lignes qui s'écartent des valeurs d'origine sont stockées : sans
// réglage, chaque document imprime EXACTEMENT ce qu'il imprimait avant la
// matrice (titres compris).
import { getRoleLabelForSchool } from "../constants.js";
import { getDefaultPoste } from "../../shared/postes-config.js";
import { tr } from "./print-helpers.js";

export const SECTION = "section";

// Catalogue des documents signés, dans l'ordre de la matrice.
//  - `section` : le document concerne un élève ou une classe, le choix
//    « chef de la section » y a donc un sens ;
//  - `defaut` : signataires d'origine ;
//  - `titres` : ce que chaque bloc imprimait avant la matrice. Ils ne valent
//    que pour le poste d'origine de l'emplacement : un reçu confié à la
//    Direction ne peut pas continuer à s'intituler « Comptable ».
export const DOCUMENTS_SIGNES = [
  { id: "recu", label: "Reçu de paiement", groupe: "Comptabilité", section: true,
    defaut: { principal: "comptable", visa: null },
    titres: { principal: () => tr("reports.accountant") } },
  { id: "etatSalaires", label: "États de salaires", groupe: "Comptabilité", section: false,
    defaut: { principal: "comptable", visa: "direction" },
    titres: { principal: () => "Le Comptable", visa: () => "Le Directeur" } },
  { id: "bulletin", label: "Bulletin", groupe: "Pédagogie", section: true,
    defaut: { principal: SECTION, visa: null },
    titres: { principal: () => tr("reports.director") } },
  { id: "ficheCompositions", label: "Fiche de compositions", groupe: "Pédagogie", section: true,
    defaut: { principal: SECTION, visa: null },
    titres: { principal: () => tr("reports.director") } },
  { id: "livret", label: "Livret scolaire", groupe: "Pédagogie", section: true,
    defaut: { principal: "direction", visa: null },
    titres: { principal: () => tr("reports.livret.directorSignature") } },
  { id: "attestation", label: "Attestation de niveau", groupe: "Scolarité", section: true,
    defaut: { principal: SECTION, visa: null },
    titres: { principal: () => tr("reports.director") } },
  { id: "ordreMutation", label: "Ordre de mutation", groupe: "Scolarité", section: true,
    defaut: { principal: "direction", visa: null },
    titres: { principal: () => tr("reports.ordreMutation.originDirector") } },
  { id: "radiation", label: "Certificat de radiation", groupe: "Scolarité", section: true,
    defaut: { principal: "direction", visa: null },
    titres: { principal: () => tr("reports.livret.directorSignature") } },
  { id: "rapportAnnuel", label: "Rapport annuel", groupe: "Direction", section: false,
    defaut: { principal: "direction", visa: null },
    titres: { principal: () => "Directeur Général" } },
];

const DOCUMENT = Object.fromEntries(DOCUMENTS_SIGNES.map((d) => [d.id, d]));

// Poste qui signe les documents D'UNE SECTION. Le préscolaire relève de la
// direction primaire, le lycée du bureau collège — mêmes regroupements que
// les modules de menu.
const POSTE_SECTION = {
  prescolaire: "primaire", maternelle: "primaire", primaire: "primaire",
  college: "college", lycee: "college", secondaire: "college",
};

// ── Ce que l'école a saisi dans Comptes & Postes ────────────────
// Prénom + nom du responsable d'un poste, dénormalisé dans
// ecoles.extra.responsables. Absent : le bloc sort avec le titre seul.
export const responsableNom = (schoolInfo = {}, cle) =>
  String(schoolInfo?.responsables?.[cle] || "").trim();

// Nom que l'école a DONNÉ au poste (ecoles.extra.libellesPostes, recopié par
// sauverPoste et par la matrice). Les libellés d'origine des postes système
// nomment des BUREAUX (« Comptabilite », « Bureau College »), pas des
// personnes : tant que l'école ne les a pas renommés, ils ne remplacent pas le
// titre habituel du document. Un poste créé par l'école, lui, n'a que son nom.
export const libelleChoisiParEcole = (schoolInfo = {}, cle) => {
  const label = String(schoolInfo?.libellesPostes?.[cle] || "").trim();
  if (!label) return "";
  return label === getDefaultPoste(cle)?.label ? "" : label;
};

// Titre imprimable d'un poste système confié à un autre document que le sien
// et jamais renommé : le nom du bureau, accentué et traduit (neutre en genre,
// là où « Le Directeur » ne l'est pas).
const titrePosteSysteme = (cle) => (getDefaultPoste(cle) ? tr(`reports.posteTitles.${cle}`) : "");

// Libellé personnalisé dans l'ancien réglage des rôles (role_settings, écoles
// venues de Firebase) — seulement s'il diffère du libellé d'origine.
const libelleRolePersonnalise = (schoolInfo, cle) => {
  const label = getRoleLabelForSchool(cle, schoolInfo);
  return label && label !== getDefaultPoste(cle)?.label ? label : "";
};

// Un poste encore existant : système (indélébile) ou présent dans les
// libellés recopiés. Un poste supprimé depuis le réglage retombe sur le
// signataire d'origine plutôt que d'imprimer un fantôme.
const posteConnu = (schoolInfo, cle) =>
  !!getDefaultPoste(cle) || !!String(schoolInfo?.libellesPostes?.[cle] || "").trim();

// ── Matrice ─────────────────────────────────────────────────────
// Matrice complète : réglages de l'école par-dessus les valeurs d'origine.
// `visa: null` explicite (visa d'origine retiré) est un choix, il est gardé.
export function normaliserMatrice(signatures = {}) {
  return Object.fromEntries(DOCUMENTS_SIGNES.map((doc) => {
    const reglage = signatures?.[doc.id] || {};
    return [doc.id, {
      principal: reglage.principal || doc.defaut.principal,
      visa: "visa" in reglage ? (reglage.visa || null) : doc.defaut.visa,
    }];
  }));
}

// Ce qu'on stocke : les seules lignes modifiées. Les documents non touchés
// suivent ainsi les valeurs d'origine, y compris si elles évoluent un jour.
export function compacterMatrice(matrice = {}) {
  const sortie = {};
  for (const doc of DOCUMENTS_SIGNES) {
    const ligne = matrice[doc.id];
    if (!ligne) continue;
    const visa = ligne.visa || null;
    if (ligne.principal !== doc.defaut.principal || visa !== doc.defaut.visa) {
      sortie[doc.id] = { principal: ligne.principal, visa };
    }
  }
  return sortie;
}

// Valeur réellement utilisée pour un emplacement : un poste supprimé, ou
// « chef de section » sur un document sans élève, retombe sur l'origine.
function valeurValide(schoolInfo, doc, emplacement, valeur) {
  if (!valeur) return null;
  if (valeur === SECTION) return doc.section ? SECTION : doc.defaut[emplacement];
  return posteConnu(schoolInfo, valeur) ? valeur : doc.defaut[emplacement];
}

function resoudre(schoolInfo, doc, emplacement, valeur, section) {
  // Le titre habituel n'appartient qu'au réglage d'ORIGINE de l'emplacement.
  const titreHabituel = valeur === doc.defaut[emplacement] ? (doc.titres[emplacement]?.() || "") : "";

  if (valeur === SECTION) {
    // Chef de la section de l'élève, ou la direction si la section n'a pas de
    // responsable désigné : mieux vaut le DG qu'une signature anonyme.
    // Réglage d'origine : titres strictement identiques à ceux d'avant.
    const cleSection = POSTE_SECTION[String(section || "").toLowerCase()] || "";
    if (cleSection && responsableNom(schoolInfo, cleSection)) {
      return {
        cle: cleSection,
        titre: libelleChoisiParEcole(schoolInfo, cleSection) || getRoleLabelForSchool(cleSection, schoolInfo)
          || titreHabituel || titrePosteSysteme(cleSection),
        nom: responsableNom(schoolInfo, cleSection),
      };
    }
    const nomDirection = responsableNom(schoolInfo, "direction");
    return {
      cle: "direction",
      titre: libelleChoisiParEcole(schoolInfo, "direction")
        || (nomDirection && getRoleLabelForSchool("direction", schoolInfo))
        || titreHabituel || titrePosteSysteme("direction"),
      nom: nomDirection,
    };
  }

  return {
    cle: valeur,
    titre: libelleChoisiParEcole(schoolInfo, valeur)
      || titreHabituel
      || libelleRolePersonnalise(schoolInfo, valeur)
      || titrePosteSysteme(valeur)
      || String(schoolInfo?.libellesPostes?.[valeur] || valeur),
    nom: responsableNom(schoolInfo, valeur),
  };
}

// Signataires d'un document, dans l'ordre : principal, puis visa éventuel.
// Chaque entrée : { role: "principal" | "visa", cle, titre, nom }.
// `section` : section de l'élève ou de la classe (documents « section »).
export function signatairesDocument(schoolInfo = {}, typeDocument, { section = "" } = {}) {
  const doc = DOCUMENT[typeDocument];
  if (!doc) throw new Error(`Document inconnu de la matrice des signatures : ${typeDocument}`);
  const reglage = normaliserMatrice(schoolInfo?.signatures)[doc.id];

  const principal = { role: "principal",
    ...resoudre(schoolInfo, doc, "principal", valeurValide(schoolInfo, doc, "principal", reglage.principal), section) };
  const valeurVisa = valeurValide(schoolInfo, doc, "visa", reglage.visa);
  if (!valeurVisa) return [principal];

  const visa = { role: "visa", ...resoudre(schoolInfo, doc, "visa", valeurVisa, section) };
  // Même personne aux deux places (ex. chef de section retombé sur la
  // direction, et direction en visa) : un seul bloc.
  return visa.cle === principal.cle ? [principal] : [principal, visa];
}

// ── Rendu ───────────────────────────────────────────────────────
// Titre, puis nom du responsable en gras dessous — le rendu historique des
// blocs de signature.
export const identiteHTML = ({ titre, nom } = {}) => (nom
  ? `${titre}<br/><span style="font-size:1.05em;font-weight:800">${nom}</span>`
  : titre);

// Blocs de signature d'un document. `bloc(identite, signataire)` fabrique UN
// bloc dans le gabarit du document ; il reçoit le rôle pour réserver par
// exemple le cachet au signataire principal.
export const blocsSignatures = (schoolInfo, typeDocument, bloc, options = {}) =>
  signatairesDocument(schoolInfo, typeDocument, options)
    .map((signataire) => bloc(identiteHTML(signataire), signataire))
    .join("");
