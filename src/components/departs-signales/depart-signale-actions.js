// Signaler / retirer / confirmer / refuser le départ d'un élève (cf.
// src/depart-signale.js).
//
// Le chef de section (ou la Direction) signale depuis le module École : la
// comptabilité est prévenue aussitôt sur son téléphone, et la ligne du
// journal apparaît dans sa cloche. Elle confirme depuis Comptabilité →
// Élèves (la fiche devient un départ et ses mensualités s'arrêtent à la date
// de départ), ou refuse en disant pourquoi ; l'auteur du signalement est
// prévenu dans les deux cas.
//
// `modChamp(id, champs)` : écriture champ par champ de la section de l'élève
// (modifierChamp de useFirestore). Le journal des actions garde les libellés
// français ; confirmations et messages suivent la langue.
import i18n from "../../i18n";
import { getAnnee } from "../../constants";
import { libelleStatutEleve } from "../../i18n/libelles";
import {
  SIGNALE_ATTENTE, champsConfirmation, getSignalement, nouveauSignalement, refuserSignalement,
} from "../../depart-signale";

const aujourdhui = () => new Date().toLocaleDateString("fr-FR");
const nomDe = (eleve = {}) => `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
// Les homonymes sont courants : classe, matricule et filiation départagent.
const identite = (eleve = {}) => [
  nomDe(eleve), eleve.classe, eleve.matricule, eleve.ien && `Matricule ${eleve.ien}`, eleve.filiation,
].filter(Boolean).join(" · ");
// « 2026-11-12 » → « 12/11/2026 » ; une autre forme passe telle quelle.
export const dateLisible = (iso = "") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};
// Libellé français pour le journal ; celui de la langue pour l'écran.
const resumeJournal = (s) => [
  `${s.statut} le ${dateLisible(s.dateDepart)}`, // i18n-ignore
  s.destinationDepart && `vers ${s.destinationDepart}`, // i18n-ignore
  s.motifDepart && `motif : ${s.motifDepart}`, // i18n-ignore
].filter(Boolean).join(" · ");
export const resumeSignalement = (s) => [
  i18n.t("departsSignales.summary", { status: libelleStatutEleve(s.statut), date: dateLisible(s.dateDepart) }),
  s.destinationDepart && i18n.t("departsSignales.summaryTo", { school: s.destinationDepart }),
  s.motifDepart,
].filter(Boolean).join(" · ");

const MESSAGES_ERREUR = {
  eleve: "departsSignales.errors.student",
  dejaParti: "departsSignales.errors.alreadyGone",
  statut: "departsSignales.errors.status",
  date: "departsSignales.errors.date",
};

export async function signalerDepart(eleve, saisie, {
  modChamp, logAction, toast, envoyerPush, auteur = "", role = "", annee = "",
}) {
  const { signalement, erreur } = nouveauSignalement(eleve, saisie, {
    annee: annee || getAnnee(), auteur, role, date: aujourdhui(),
  });
  if (erreur) { toast?.(i18n.t(MESSAGES_ERREUR[erreur]), "warning"); return false; }
  const nom = nomDe(eleve);
  if (!confirm(i18n.t("departsSignales.confirmSend", { identity: identite(eleve), summary: resumeSignalement(signalement) }))) return false;

  await modChamp(eleve._id, { departSignale: signalement });
  // i18n-ignore
  logAction?.("Départ d'élève signalé à la comptabilité", `${identite(eleve)} · ${resumeJournal(signalement)}`);
  envoyerPush?.(["comptable"],
    `📤 ${i18n.t("departsSignales.pushTitle")}`,
    i18n.t("departsSignales.pushBody", { name: nom, classe: eleve.classe || "", summary: resumeSignalement(signalement), author: auteur || "—" }),
    "/");
  toast?.(i18n.t("departsSignales.sent", { name: nom }), "success");
  return true;
}

// L'auteur retire son signalement : en attente (il s'est trompé, l'élève
// reste), ou refusé et lu (il a pris connaissance de la raison).
export async function retirerSignalement(eleve, { modChamp, logAction, toast }) {
  const signalement = getSignalement(eleve);
  if (!signalement) return false;
  const enAttente = signalement.etat === SIGNALE_ATTENTE;
  if (enAttente && !confirm(i18n.t("departsSignales.withdrawConfirm", { identity: identite(eleve) }))) return false;
  await modChamp(eleve._id, { departSignale: null });
  if (enAttente) {
    // i18n-ignore
    logAction?.("Signalement de départ retiré", `${identite(eleve)} · ${resumeJournal(signalement)}`);
    toast?.(i18n.t("departsSignales.withdrawn", { name: nomDe(eleve) }), "success");
  }
  return true;
}

// La comptabilité confirme : la fiche devient un départ, aux règles du
// formulaire de l'élève (date obligatoire, école d'accueil pour un
// transfert seulement).
export async function confirmerDepartSignale(eleve, {
  modChamp, logAction, toast, envoyerPush, auteur = "", annee = "",
}) {
  const signalement = getSignalement(eleve, annee);
  if (!signalement || signalement.etat !== SIGNALE_ATTENTE) return false;
  const champs = champsConfirmation(signalement);
  if (!champs) { toast?.(i18n.t("departsSignales.errors.date"), "warning"); return false; }
  const nom = nomDe(eleve);
  if (!confirm(i18n.t("departsSignales.confirmDeparture", { identity: identite(eleve), summary: resumeSignalement(signalement) }))) return false;

  await modChamp(eleve._id, champs);
  // i18n-ignore
  logAction?.("Départ d'élève confirmé par la comptabilité",
    `${identite(eleve)} · ${resumeJournal(signalement)} · signalé par ${signalement.signalePar || "—"} le ${signalement.signaleLe || "—"}`); // i18n-ignore
  if (signalement.signaleParRole) {
    envoyerPush?.([signalement.signaleParRole],
      `📤 ${i18n.t("departsSignales.pushConfirmedTitle")}`,
      i18n.t("departsSignales.pushConfirmedBody", { name: nom, classe: eleve.classe || "", author: auteur || "—" }),
      "/");
  }
  toast?.(i18n.t("departsSignales.confirmed", { name: nom }), "success");
  return true;
}

// La comptabilité refuse, et dit pourquoi : l'élève reste inscrit chez elle
// (il paie, il a payé l'année, l'école d'accueil n'a rien demandé…). Le
// signalement reste sur la fiche, marqué refusé, jusqu'à ce que son auteur
// le retire de sa liste.
export async function refuserDepartSignale(eleve, motifRefus, {
  modChamp, logAction, toast, envoyerPush, auteur = "", annee = "",
}) {
  const signalement = getSignalement(eleve, annee);
  if (!signalement || signalement.etat !== SIGNALE_ATTENTE) return false;
  const raison = String(motifRefus || "").trim();
  if (!raison) { toast?.(i18n.t("departsSignales.refuseNeedsReason"), "warning"); return false; }

  await modChamp(eleve._id, {
    departSignale: refuserSignalement(signalement, { motifRefus: raison, auteur, date: aujourdhui() }),
  });
  // i18n-ignore
  logAction?.("Signalement de départ refusé par la comptabilité",
    `${identite(eleve)} · ${resumeJournal(signalement)} · signalé par ${signalement.signalePar || "—"} · raison du refus : ${raison}`); // i18n-ignore
  if (signalement.signaleParRole) {
    envoyerPush?.([signalement.signaleParRole],
      `📤 ${i18n.t("departsSignales.pushRefusedTitle")}`,
      i18n.t("departsSignales.pushRefusedBody", { name: nomDe(eleve), classe: eleve.classe || "", reason: raison }),
      "/");
  }
  toast?.(i18n.t("departsSignales.refused", { name: nomDe(eleve) }), "success");
  return true;
}
