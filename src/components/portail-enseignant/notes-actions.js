// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — actions sur les notes (CRUD + grille)
// ══════════════════════════════════════════════════════════════
// Extrait de PortailEnseignant.jsx au refactor découpage 2026-05-20.
// Toutes les actions reçoivent leurs dépendances UI/data en injection
// (apiFetch, getAuthHeaders, toast, schoolInfo, utilisateur, etc.)
// pour rester découplées du parent.

import { apiFetch, getAuthHeaders } from "../../apiClient";
import { resolveCanonicalNoteType } from "../../evaluation-forms";

// Pré-remplit la grille de saisie pour un trio (classe, type, période)
// en récupérant les notes existantes par élève.
export function construireGrille({ classe, type, periode, eleves, mesNotes, schoolInfo, utilisateur }) {
  const map = {};
  eleves
    .filter((e) => e.classe === classe)
    .forEach((e) => {
      const existante = mesNotes.find(
        (n) => n.eleveId === e._id && n.periode === periode && resolveCanonicalNoteType(n.type, schoolInfo, utilisateur.section || "secondaire") === type,
      );
      map[e._id] = existante ? String(existante.note ?? "") : "";
    });
  return map;
}

// Enregistre la grille complète (1 requête API par cellule non vide).
// Met à jour gridProgress en cours pour afficher la progression.
export async function enregistrerGrille({
  gridForm,
  mesNotes,
  schoolInfo,
  utilisateur,
  setEnregistrement,
  setGridProgress,
  setModalNote,
  chargerPortail,
  toast,
}) {
  const canonical = resolveCanonicalNoteType(gridForm.type, schoolInfo, utilisateur.section || "secondaire");
  const aSauver = Object.entries(gridForm.notes)
    .filter(([, val]) => val !== "" && val != null)
    .map(([eleveId, val]) => {
      const existante = mesNotes.find(
        (n) => n.eleveId === eleveId && n.periode === gridForm.periode && resolveCanonicalNoteType(n.type, schoolInfo, utilisateur.section || "secondaire") === canonical,
      );
      return { eleveId, note: Number(val), noteId: existante?._id || "" };
    });
  if (aSauver.length === 0) {
    toast("Saisis au moins une note avant d'enregistrer.", "warning");
    return;
  }
  const invalide = aSauver.find((n) => !Number.isFinite(n.note) || n.note < 0 || n.note > 20);
  if (invalide) {
    toast("Note invalide détectée (doit être un nombre entre 0 et 20).", "warning");
    return;
  }
  setEnregistrement(true);
  setGridProgress({ done: 0, total: aSauver.length });
  let nbOk = 0;
  let nbKo = 0;
  try {
    for (const item of aSauver) {
      try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        const res = await apiFetch("/teacher-portal", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "save_note",
            noteId: item.noteId,
            eleveId: item.eleveId,
            type: canonical,
            periode: gridForm.periode,
            note: item.note,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) nbOk++;
        else nbKo++;
      } catch {
        nbKo++;
      }
      setGridProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    await chargerPortail();
    if (nbKo === 0) {
      toast(`${nbOk} note(s) enregistrée(s).`, "success");
      setModalNote(null);
    } else {
      toast(`${nbOk} OK / ${nbKo} échec(s). Réessaie pour les lignes en rouge.`, "warning");
    }
  } finally {
    setEnregistrement(false);
  }
}

// Enregistre une note individuelle (création ou édition selon noteId).
export async function enregistrerNote({
  formNote, defaultNoteType, schoolInfo, utilisateur,
  setEnregistrement, setModalNote, chargerPortail, toast,
}) {
  if (!formNote.eleveId || formNote.note === "" || !formNote.periode) {
    toast("Eleve, periode et note requis.", "warning");
    return;
  }
  setEnregistrement(true);
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await apiFetch("/teacher-portal", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "save_note",
        noteId: formNote.noteId || "",
        eleveId: formNote.eleveId,
        type: resolveCanonicalNoteType(formNote.type || defaultNoteType, schoolInfo, utilisateur.section || "secondaire"),
        periode: formNote.periode,
        note: Number(formNote.note),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Enregistrement impossible.");
    }
    setModalNote(null);
    await chargerPortail();
    toast("Note enregistree.", "success");
  } catch (error) {
    toast(error.message || "Erreur d'enregistrement.", "error");
  } finally {
    setEnregistrement(false);
  }
}

// Supprime une note avec confirmation.
export async function supprimerNote(noteId, { setEnregistrement, chargerPortail, toast }) {
  if (!noteId || !window.confirm("Supprimer cette note ?")) return;
  setEnregistrement(true);
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await apiFetch("/teacher-portal", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "delete_note", noteId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Suppression impossible.");
    }
    await chargerPortail();
    toast("Note supprimee.", "success");
  } catch (error) {
    toast(error.message || "Erreur de suppression.", "error");
  } finally {
    setEnregistrement(false);
  }
}
