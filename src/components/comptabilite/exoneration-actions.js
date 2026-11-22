// Accorder / retirer une dispense de paiement à un élève.
//
// RÉSERVÉ À LA DIRECTION, et le contrôle est ici, pas seulement dans l'écran :
// une dispense efface une dette. Si la comptabilité pouvait l'accorder, un
// encaissement en espèces pourrait être couvert après coup en passant l'élève
// « dispensé ». La comptabilité voit les dispenses, elle ne les décide pas.
//
// Chaque décision laisse une trace au journal des actions (qui, quand, quel
// élève, quelle portée, quel motif) : c'est ce qui rend la dispense défendable
// le jour où on demande des comptes.
//
// La comptabilité, elle, DEMANDE : la demande attend la Direction sur la fiche
// de l'élève (cf. demande-dispense), qui l'accorde, la corrige ou la refuse.
import i18n from "../../i18n";
import { getAnnee } from "../../constants";
import {
  libelleMotif, normaliserExoneration, resumeExoneration,
} from "../../exoneration-utils";
import {
  STATUT_ATTENTE, getDemande, nouvelleDemande, refuserDemande,
} from "../../demande-dispense";
import { resumeExonerationAffiche } from "./exoneration-affichage";

// Le journal des actions garde les libellés français (resumeExoneration,
// libelleMotif) ; confirmations et messages suivent la langue.
export const refusNonDirection = () => i18n.t("accounting.exempt.onlyDirection");

// De quel élève parle-t-on, exactement : les homonymes sont courants, et
// l'IEN comme la filiation sont ce qui les départage. Repris dans la
// confirmation ET dans le journal, pour qu'une relecture ultérieure sache sur
// qui la dispense est tombée.
const identite = (eleve = {}) => [
  `${eleve.nom || ""} ${eleve.prenom || ""}`.trim(),
  eleve.classe,
  eleve.matricule,
  eleve.ien && `Matricule ${eleve.ien}`,
  eleve.filiation,
].filter(Boolean).join(" · ");

export async function accorderExoneration(eleve, brouillon, {
  estDirection, modEleves, logAction, toast, auteur = "", annee = "",
}) {
  if (!estDirection) { toast?.(refusNonDirection(), "warning"); return false; }

  const exoneration = normaliserExoneration({
    ...brouillon,
    annee: annee || getAnnee(),
    accordeePar: auteur || brouillon.accordeePar || "",
    accordeeLe: new Date().toLocaleDateString("fr-FR"),
  });
  if (!exoneration) { toast?.(i18n.t("accounting.exempt.pickPost"), "warning"); return false; }
  if (exoneration.motif === "autre" && !exoneration.precision) {
    toast?.(i18n.t("accounting.exempt.otherNeedsReason"), "warning"); return false;
  }

  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  if (!confirm(i18n.t("accounting.exempt.confirmGrant", { identity: identite(eleve), summary: resumeExonerationAffiche({ exoneration }) }))) return false;

  // Accorder répond à la demande de la comptabilité s'il y en a une (telle
  // quelle ou corrigée) : elle quitte la fiche, le journal garde qui l'avait
  // demandée.
  const demande = getDemande(eleve);
  await modEleves(eleve._id, demande ? { exoneration, demandeDispense: null } : { exoneration });
  // i18n-ignore
  const surDemande = demande?.demandeePar ? ` · demandée par ${demande.demandeePar}` : "";
  // i18n-ignore
  logAction?.("Dispense de paiement accordée",
    `${identite(eleve)} · ${resumeExoneration({ exoneration })} · ${libelleMotif(exoneration.motif)}${exoneration.precision ? ` (${exoneration.precision})` : ""}${surDemande}`);
  toast?.(i18n.t("accounting.exempt.granted", { name: nom }), "success");
  return true;
}

// La comptabilité propose une dispense à la Direction. Mêmes contrôles qu'à
// l'accord (au moins un poste, « Autre » précisé) : la Direction doit pouvoir
// l'accorder d'un clic. Elle est prévenue tout de suite : notification sur
// son téléphone, et la ligne du journal apparaît dans sa cloche.
export async function demanderDispense(eleve, brouillon, {
  estDirection, modEleves, logAction, toast, envoyerPush, auteur = "", annee = "",
}) {
  // La Direction n'a rien à demander : elle accorde.
  if (estDirection) return false;

  const demande = nouvelleDemande(brouillon, {
    annee: annee || getAnnee(), auteur, date: new Date().toLocaleDateString("fr-FR"),
  });
  if (!demande) { toast?.(i18n.t("accounting.exempt.pickPost"), "warning"); return false; }
  if (demande.motif === "autre" && !demande.precision) {
    toast?.(i18n.t("accounting.exempt.otherNeedsReason"), "warning"); return false;
  }

  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  const resume = resumeExonerationAffiche({ exoneration: demande });
  if (!confirm(i18n.t("accounting.exempt.request.confirm", { identity: identite(eleve), summary: resume }))) return false;

  await modEleves(eleve._id, { demandeDispense: demande });
  // i18n-ignore
  logAction?.("Dispense de paiement demandée à la Direction",
    `${identite(eleve)} · ${resumeExoneration({ exoneration: demande })} · ${libelleMotif(demande.motif)}${demande.precision ? ` (${demande.precision})` : ""}`);
  envoyerPush?.(["direction"],
    `🎓 ${i18n.t("accounting.exempt.request.pushTitle")}`,
    i18n.t("accounting.exempt.request.pushBody", { name: nom, classe: eleve.classe || "", summary: resume, author: auteur || "—" }),
    "/");
  toast?.(i18n.t("accounting.exempt.request.sent", { name: nom }), "success");
  return true;
}

// La Direction refuse, et dit pourquoi : la comptable devra l'expliquer à la
// famille. La demande reste sur la fiche, marquée refusée, jusqu'à ce que la
// comptable la retire de sa liste.
export async function refuserDemandeDispense(eleve, motifRefus, {
  estDirection, modEleves, logAction, toast, auteur = "", annee = "",
}) {
  if (!estDirection) { toast?.(refusNonDirection(), "warning"); return false; }
  const demande = getDemande(eleve, annee);
  if (!demande || demande.statut !== STATUT_ATTENTE) return false;
  const raison = String(motifRefus || "").trim();
  if (!raison) { toast?.(i18n.t("accounting.exempt.request.refuseNeedsReason"), "warning"); return false; }

  await modEleves(eleve._id, {
    demandeDispense: refuserDemande(demande, { motifRefus: raison, auteur, date: new Date().toLocaleDateString("fr-FR") }),
  });
  // i18n-ignore
  const detail = `${identite(eleve)} · ${resumeExoneration({ exoneration: demande })} · demandée par ${demande.demandeePar || "—"} · raison du refus : ${raison}`;
  // i18n-ignore
  logAction?.("Demande de dispense refusée", detail);
  toast?.(i18n.t("accounting.exempt.request.refused", { name: `${eleve.nom || ""} ${eleve.prenom || ""}`.trim() }), "success");
  return true;
}

// La comptable retire sa demande : en attente (elle s'est trompée, la famille
// a payé), ou refusée et lue (elle a pris connaissance de la raison).
export async function retirerDemandeDispense(eleve, { modEleves, logAction, toast }) {
  const demande = getDemande(eleve);
  if (!demande) return false;
  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  const enAttente = demande.statut === STATUT_ATTENTE;
  if (enAttente && !confirm(i18n.t("accounting.exempt.request.withdrawConfirm", { identity: identite(eleve) }))) return false;

  await modEleves(eleve._id, { demandeDispense: null });
  if (enAttente) {
    // i18n-ignore
    logAction?.("Demande de dispense retirée", `${identite(eleve)} · ${resumeExoneration({ exoneration: demande })}`);
    toast?.(i18n.t("accounting.exempt.request.withdrawn", { name: nom }), "success");
  }
  return true;
}

export async function retirerExoneration(eleve, { estDirection, modEleves, logAction, toast }) {
  if (!estDirection) { toast?.(refusNonDirection(), "warning"); return false; }

  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  if (!confirm(i18n.t("accounting.exempt.confirmRemove", { identity: identite(eleve) }))) return false;

  await modEleves(eleve._id, { exoneration: null });
  // i18n-ignore
  logAction?.("Dispense de paiement retirée", `${identite(eleve)} · ${resumeExoneration(eleve) || "—"}`);
  toast?.(i18n.t("accounting.exempt.removed", { name: nom }), "success");
  return true;
}
