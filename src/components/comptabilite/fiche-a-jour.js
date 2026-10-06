// ══════════════════════════════════════════════════════════════
//  Fiche à jour avant d'encaisser — logique pure
// ══════════════════════════════════════════════════════════════
// Un encaissement se calcule sur la fiche AFFICHÉE. Si elle a changé depuis
// (autre poste qui encaisse le même élève, écran pas encore rafraîchi), on
// encaisse une seconde fois des mois déjà payés, et l'écriture — qui réécrit
// l'objet `mens` en entier — efface au passage ce que l'autre a enregistré.
// Cas réel : quatre mois cochés un par un, puis 8 s plus tard un versement
// calculé sur la fiche d'avant, qui reprend ces quatre mois → 600 000 GNF
// comptés deux fois en caisse.
//
// Règle : on compare la fiche affichée aux versions relues juste avant
// d'écrire (miroir local + serveur). Est un conflit tout paiement que la
// version relue connaît et que la fiche affichée ignore : un poste soldé, un
// acompte plus élevé — ou, pour un retrait, un poste déjà retiré. L'inverse
// (la fiche affichée en avance sur le serveur) n'en est pas un : c'est notre
// propre écriture qui n'est pas encore remontée.

import { getFraisAnnexeLabel } from "../../constants";

const positif = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Tous les postes de paiement d'une fiche : { cle, libelle, paye, acompte }.
function postes(fiche = {}) {
  const liste = new Map();
  const mens = fiche.mens || {};
  const mensAcomptes = fiche.mensAcomptes || {};
  for (const mois of new Set([...Object.keys(mens), ...Object.keys(mensAcomptes)])) {
    liste.set(`mois:${mois}`, { libelle: mois, paye: mens[mois] === "Payé", acompte: positif(mensAcomptes[mois]) });
  }
  liste.set("inscription", {
    libelle: "Inscription", paye: !!fiche.inscriptionPayee, acompte: positif(fiche.inscriptionAcompte),
  });
  const fraisPayes = fiche.fraisPayes || {};
  const fraisAcomptes = fiche.fraisAcomptes || {};
  for (const id of new Set([...Object.keys(fraisPayes), ...Object.keys(fraisAcomptes)])) {
    liste.set(`frais:${id}`, { libelle: getFraisAnnexeLabel(id), paye: !!fraisPayes[id], acompte: positif(fraisAcomptes[id]) });
  }
  return liste;
}

const VIDE = { paye: false, acompte: 0 };

// Libellés des postes sur lesquels `fraiche` a enregistré plus que `affichee`.
// `retrait` : le poste visé (même clé que postes()) que l'on s'apprête à
// retirer — conflit aussi s'il est déjà retiré dans `fraiche`.
export function paiementsIgnores(affichee = {}, fraiche = {}, { retrait = null } = {}) {
  const avant = postes(affichee);
  const apres = postes(fraiche);
  const ignores = [];
  for (const [cle, p] of apres) {
    const a = avant.get(cle) || { ...VIDE, libelle: p.libelle };
    const enAvance = (p.paye && !a.paye) || (!p.paye && !a.paye && p.acompte > a.acompte);
    const dejaRetire = cle === retrait && a.paye && !p.paye;
    if (enAvance || dejaRetire) ignores.push(p.libelle);
  }
  if (retrait && !apres.has(retrait) && avant.get(retrait)?.paye) ignores.push(avant.get(retrait).libelle);
  return ignores;
}

// Clés de poste, pour `retrait`.
export const clePosteMois = (mois) => `mois:${mois}`;
export const clePosteFrais = (poste) => (poste === "inscription" ? "inscription" : `frais:${poste}`);

// Premier conflit trouvé parmi les versions relues, ou null.
export function conflitFiche(affichee, versions = [], opts) {
  for (const version of versions) {
    const ignores = paiementsIgnores(affichee, version, opts);
    if (ignores.length) return ignores;
  }
  return null;
}

export const messageConflit = (nomEleve, ignores = []) =>
  `La fiche de ${nomEleve || "cet élève"} a changé entre-temps (${ignores.join(", ")}) : `
  + "un autre encaissement vient d'être enregistré. Rien n'a été encaissé — "
  + "attendez que la fiche se mette à jour, vérifiez, puis recommencez.";
