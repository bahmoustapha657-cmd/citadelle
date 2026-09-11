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
import { getAnnee } from "../../constants";
import {
  libelleMotif, normaliserExoneration, resumeExoneration,
} from "../../exoneration-utils";

export const REFUS_NON_DIRECTION = "Seule la Direction Générale peut accorder ou retirer une dispense de paiement.";

export async function accorderExoneration(eleve, brouillon, {
  estDirection, modEleves, logAction, toast, auteur = "", annee = "",
}) {
  if (!estDirection) { toast?.(REFUS_NON_DIRECTION, "warning"); return false; }

  const exoneration = normaliserExoneration({
    ...brouillon,
    annee: annee || getAnnee(),
    accordeePar: auteur || brouillon.accordeePar || "",
    accordeeLe: new Date().toLocaleDateString("fr-FR"),
  });
  if (!exoneration) { toast?.("Choisissez au moins un poste à dispenser (taux supérieur à 0).", "warning"); return false; }
  if (exoneration.motif === "autre" && !exoneration.precision) {
    toast?.("Motif « Autre » : précisez la raison de la dispense.", "warning"); return false;
  }

  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  if (!confirm(`Dispenser ${nom} — ${resumeExoneration({ exoneration })} ?`)) return false;

  await modEleves(eleve._id, { exoneration });
  logAction?.("Dispense de paiement accordée",
    `${nom} · ${resumeExoneration({ exoneration })} · ${libelleMotif(exoneration.motif)}${exoneration.precision ? ` (${exoneration.precision})` : ""}`);
  toast?.(`Dispense accordée à ${nom}.`, "success");
  return true;
}

export async function retirerExoneration(eleve, { estDirection, modEleves, logAction, toast }) {
  if (!estDirection) { toast?.(REFUS_NON_DIRECTION, "warning"); return false; }

  const nom = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
  if (!confirm(`Retirer la dispense de ${nom} ? Les mois non réglés redeviendront des impayés.`)) return false;

  await modEleves(eleve._id, { exoneration: null });
  logAction?.("Dispense de paiement retirée", `${nom} · ${resumeExoneration(eleve) || "—"}`);
  toast?.(`Dispense retirée pour ${nom}.`, "success");
  return true;
}
