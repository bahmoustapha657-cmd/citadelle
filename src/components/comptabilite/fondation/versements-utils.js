// Versements du comptable : l'argent de la caisse remis à la banque ou à la
// Fondation. Logique pure (filtre, tri, totaux) partagée par l'onglet et par
// l'impression de la situation des versements.
import { parseDateSouple } from "../caisse/caisse-utils";

// À qui l'argent est remis. Les versements saisis avant ce champ n'en ont
// pas : ils restent affichés (« — ») et ne sortent que sans filtre.
export const BENEFICIAIRES = ["Banque", "Fondation", "Autre"];

// Versements de la période [du, au] (dates « AAAA-MM-JJ » des champs de
// saisie, bornes incluses, l'une ou l'autre facultative) et du bénéficiaire
// choisi (« » = tous), du plus ancien au plus récent. Un versement sans date
// lisible ne tombe dans aucune période : il ne sort que sans filtre de date.
export function filtrerVersements(versements = [], { du = "", au = "", beneficiaire = "" } = {}) {
  const debut = parseDateSouple(du);
  const fin = parseDateSouple(au);
  return versements
    .map((v) => ({ v, date: parseDateSouple(v.date) }))
    .filter(({ v, date }) => {
      if (beneficiaire && (v.beneficiaire || "") !== beneficiaire) return false;
      if (!debut && !fin) return true;
      if (!date) return false;
      return (!debut || date >= debut) && (!fin || date <= fin);
    })
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity))
    .map(({ v }) => v);
}

// Total, nombre, et détail par bénéficiaire (dans l'ordre de BENEFICIAIRES,
// « Non précisé » en dernier) — seulement ceux qui ont reçu quelque chose.
export function resumeVersements(versements = []) {
  const parBeneficiaire = new Map();
  let total = 0;
  for (const v of versements) {
    const montant = Number(v.montant) || 0;
    total += montant;
    const cle = BENEFICIAIRES.includes(v.beneficiaire) ? v.beneficiaire : "Non précisé";
    const ligne = parBeneficiaire.get(cle) || { beneficiaire: cle, total: 0, nb: 0 };
    ligne.total += montant;
    ligne.nb += 1;
    parBeneficiaire.set(cle, ligne);
  }
  const ordre = [...BENEFICIAIRES, "Non précisé"];
  return {
    total,
    nb: versements.length,
    parBeneficiaire: ordre.filter((cle) => parBeneficiaire.has(cle)).map((cle) => parBeneficiaire.get(cle)),
  };
}

// « 2026-09-12 » → « 12/09/2026 » ; toute autre valeur rendue telle quelle.
export const dateCourte = (valeur) => {
  const d = parseDateSouple(valeur);
  return d ? d.toLocaleDateString("fr-FR") : String(valeur || "");
};

// Période imprimée sous le titre ; "" quand on imprime toute l'année.
export function libellePeriodeVersements({ du = "", au = "" } = {}) {
  if (du && au) return `Du ${dateCourte(du)} au ${dateCourte(au)}`;
  if (du) return `Depuis le ${dateCourte(du)}`;
  if (au) return `Jusqu'au ${dateCourte(au)}`;
  return "";
}
