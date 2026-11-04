// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — actions sur les incidents (CRUD)
// ══════════════════════════════════════════════════════════════
// Extrait de PortailEnseignant.jsx au refactor découpage 2026-05-20.
// Push notification au parent à la CRÉATION uniquement (pas en édition),
// pour éviter de spammer si l'enseignant corrige une faute de frappe.

import { saveIncident, deleteIncident } from "../../backend/teacher-portal-supabase";
import i18n from "../../i18n";

// Types de signalement : la valeur enregistrée reste en français (lue par la
// direction, les parents et les états imprimés) ; seul le libellé se traduit.
// i18n-ignore
export const TYPES_INCIDENT = { Absence: "absence", Retard: "retard", Avertissement: "avertissement", Sanction: "sanction", "Renvoi temporaire": "renvoi" };
// i18n-ignore
export const COULEUR_TYPE_INCIDENT = { Absence: "red", Retard: "amber", Avertissement: "amber", Sanction: "red", "Renvoi temporaire": "red" };

export function libelleTypeIncident(type) {
  const cle = TYPES_INCIDENT[type];
  return cle ? i18n.t(`teacher.incident.types.${cle}`) : type;
}

// Enregistre un signalement (création ou édition selon incidentId).
// Notifie les parents par push uniquement à la création.
export async function enregistrerIncident({
  formIncident,
  envoyerPush,
  setEnregistrement,
  setModalIncident,
  chargerPortail,
  toast,
}) {
  if (!formIncident.eleveId || !formIncident.type || !formIncident.date) {
    toast(i18n.t("teacher.incident.required"), "warning");
    return;
  }
  setEnregistrement(true);
  try {
    await saveIncident({
      incidentId: formIncident.incidentId || "",
      eleveId: formIncident.eleveId,
      type: formIncident.type,
      date: formIncident.date,
      justifie: formIncident.justifie || "Non",
      motif: formIncident.motif || "",
    });
    // Push aux parents de l'élève — uniquement à la création (pas en édition).
    if (!formIncident.incidentId && envoyerPush) {
      const type = formIncident.type || "Absence";
      const eleveNom = formIncident.eleveNom || i18n.t("teacher.incident.yourChild");
      const date = formIncident.date || new Date().toISOString().slice(0, 10);
      const motif = formIncident.motif ? ` : ${formIncident.motif}` : "";
      envoyerPush(
        ["parent"],
        `⚠️ ${i18n.t("teacher.incident.pushTitle", { type: libelleTypeIncident(type) })}`,
        i18n.t("teacher.incident.pushBody", { name: eleveNom, type: libelleTypeIncident(type), date, reason: motif }),
        "/absences",
        { eleveId: formIncident.eleveId },
      );
    }
    setModalIncident(null);
    await chargerPortail();
    toast(i18n.t("teacher.incident.saved"), "success");
  } catch (error) {
    toast(error.message || i18n.t("teacher.incident.saveError"), "error");
  } finally {
    setEnregistrement(false);
  }
}

// Supprime un signalement avec confirmation. Pas de push.
export async function supprimerIncident(incidentId, { setEnregistrement, chargerPortail, toast }) {
  if (!incidentId || !window.confirm(i18n.t("teacher.incident.deleteConfirm"))) return;
  setEnregistrement(true);
  try {
    await deleteIncident(incidentId);
    await chargerPortail();
    toast(i18n.t("teacher.incident.deleted"), "success");
  } catch (error) {
    toast(error.message || i18n.t("teacher.incident.deleteError"), "error");
  } finally {
    setEnregistrement(false);
  }
}
