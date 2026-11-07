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
import i18n from "../../i18n";
import { getAnnee } from "../../constants";
import {
  libelleMotif, normaliserExoneration, resumeExoneration,
} from "../../exoneration-utils";
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
  eleve.ien && `IEN ${eleve.ien}`,
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

  await modEleves(eleve._id, { exoneration });
  // i18n-ignore
  logAction?.("Dispense de paiement accordée",
    `${identite(eleve)} · ${resumeExoneration({ exoneration })} · ${libelleMotif(exoneration.motif)}${exoneration.precision ? ` (${exoneration.precision})` : ""}`);
  toast?.(i18n.t("accounting.exempt.granted", { name: nom }), "success");
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
