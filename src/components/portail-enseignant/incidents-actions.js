// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — actions sur les incidents (CRUD)
// ══════════════════════════════════════════════════════════════
// Extrait de PortailEnseignant.jsx au refactor découpage 2026-05-20.
// Push notification au parent à la CRÉATION uniquement (pas en édition),
// pour éviter de spammer si l'enseignant corrige une faute de frappe.

import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import { saveIncident, deleteIncident } from "../../backend/teacher-portal-supabase";

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
    toast("Élève, type et date requis.", "warning");
    return;
  }
  setEnregistrement(true);
  try {
    if (isSupabase) {
      await saveIncident({
        incidentId: formIncident.incidentId || "",
        eleveId: formIncident.eleveId,
        type: formIncident.type,
        date: formIncident.date,
        justifie: formIncident.justifie || "Non",
        motif: formIncident.motif || "",
      });
    } else {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/teacher-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "save_incident",
          incidentId: formIncident.incidentId || "",
          eleveId: formIncident.eleveId,
          type: formIncident.type,
          date: formIncident.date,
          justifie: formIncident.justifie || "Non",
          motif: formIncident.motif || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Enregistrement impossible.");
      }
    }
    // Push aux parents — uniquement à la création (pas en édition).
    if (!formIncident.incidentId && envoyerPush) {
      const type = formIncident.type || "Absence";
      const eleveNom = formIncident.eleveNom || "Votre enfant";
      const date = formIncident.date || new Date().toISOString().slice(0, 10);
      const motif = formIncident.motif ? ` : ${formIncident.motif}` : "";
      envoyerPush(
        ["parent"],
        `⚠️ ${type} signalée par l'enseignant`,
        `${eleveNom} — ${type} du ${date}${motif}`,
        "/absences",
      );
    }
    setModalIncident(null);
    await chargerPortail();
    toast("Signalement enregistré. Les parents ont été notifiés.", "success");
  } catch (error) {
    toast(error.message || "Erreur d'enregistrement.", "error");
  } finally {
    setEnregistrement(false);
  }
}

// Supprime un signalement avec confirmation. Pas de push.
export async function supprimerIncident(incidentId, { setEnregistrement, chargerPortail, toast }) {
  if (!incidentId || !window.confirm("Supprimer ce signalement ?")) return;
  setEnregistrement(true);
  try {
    if (isSupabase) {
      await deleteIncident(incidentId);
    } else {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/teacher-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete_incident", incidentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Suppression impossible.");
      }
    }
    await chargerPortail();
    toast("Signalement supprimé.", "success");
  } catch (error) {
    toast(error.message || "Erreur de suppression.", "error");
  } finally {
    setEnregistrement(false);
  }
}
