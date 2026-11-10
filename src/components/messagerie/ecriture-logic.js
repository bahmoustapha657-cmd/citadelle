// ── « En train d'écrire… » ──────────────────────────────────────────────────
// Signal éphémère sur le canal privé de la discussion (jamais en base). Le
// quota Realtime est compté : on signale au plus une fois toutes les 3 s tant
// que la frappe dure, et l'indication s'éteint seule 6 s après le dernier
// signal (un « j'arrête » perdu sur réseau faible ne la laisse pas allumée).
// Module sans dépendance, testé sous Node : tests/messagerie-ecriture.test.js.
import i18n from "../../i18n";

export const INTERVALLE_SIGNAL_MS = 3000;
export const DUREE_INDICATION_MS = 6000;

// Côté qui écrit : `frappe(texte)` à chaque changement de la saisie.
export function creerEmetteur(envoyer, { intervalle = INTERVALLE_SIGNAL_MS } = {}) {
  let dernier = -Infinity;
  let actif = false;
  return {
    frappe(texte, maintenant = Date.now()) {
      if (!String(texte || "").trim()) { this.arret(); return; }
      if (maintenant - dernier < intervalle) return;
      dernier = maintenant;
      actif = true;
      envoyer("e");
    },
    // Message envoyé, saisie vidée, discussion quittée.
    arret() {
      if (!actif) return;
      actif = false;
      dernier = -Infinity;
      envoyer("f");
    },
  };
}

// Côté qui lit : qui écrit en ce moment ? `recevoir` renvoie l'échéance à
// laquelle revérifier.
export function creerSuivi({ duree = DUREE_INDICATION_MS } = {}) {
  const jusqua = new Map();
  return {
    recevoir(evenement, de, maintenant = Date.now()) {
      if (!de) return;
      if (evenement === "e") jusqua.set(de, maintenant + duree);
      else jusqua.delete(de);
    },
    // Son message vient d'arriver : il n'écrit plus.
    oublier(de) { jusqua.delete(de); },
    actifs(maintenant = Date.now()) {
      for (const [de, fin] of jusqua) if (fin <= maintenant) jusqua.delete(de);
      return [...jusqua.keys()];
    },
    prochaineEcheance() { return jusqua.size ? Math.min(...jusqua.values()) : null; },
  };
}

// Texte de l'en-tête : « écrit… » à deux, le prénom dans un groupe.
export function libelleEcriture(ids, { groupe, annuaire }) {
  if (!ids?.length) return "";
  if (!groupe) return i18n.t("msg.conv.typing");
  if (ids.length > 1) return i18n.t("msg.conv.typingMany", { count: ids.length });
  const nom = annuaire?.get(ids[0])?.nom;
  return nom ? i18n.t("msg.conv.typingName", { name: nom.split(/\s+/)[0] }) : i18n.t("msg.conv.typing");
}

// Fichiers d'un collage ou d'un dépôt (photo copiée, capture d'écran, fichier
// glissé) ; rien si l'on colle ou dépose du texte.
export function fichiersTransferes(transfert) {
  const directs = Array.from(transfert?.files || []);
  if (directs.length) return directs;
  return Array.from(transfert?.items || [])
    .filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean);
}
