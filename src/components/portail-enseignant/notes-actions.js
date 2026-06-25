// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — actions sur les notes (CRUD + grille)
// ══════════════════════════════════════════════════════════════
// Extrait de PortailEnseignant.jsx au refactor découpage 2026-05-20.
// Orchestrateur : la grille (pré-remplissage, collecte, validation) vit dans
// ./notes-grid et les appels réseau dans ./notes-api. Toutes les actions
// reçoivent leurs dépendances UI/data en injection pour rester découplées.

import { construireGrille, collectGridNotes, validateGridNotes } from "./notes-grid";
import { saveNoteApi, saveNotesApi, deleteNoteApi } from "./notes-api";
import { resolveCanonicalNoteType } from "../../evaluation-forms";
import { getAnnee } from "../../constants";

// Ré-export pour préserver le point d'import unique du parent.
export { construireGrille };

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
  onSuccess,
  onQueued,
}) {
  const { canonical, aSauver } = collectGridNotes({ gridForm, mesNotes, schoolInfo, utilisateur });
  const maxNote = (utilisateur.section === "primaire") ? 10 : 20;
  const invalide = validateGridNotes(aSauver, maxNote);
  if (invalide) {
    toast(invalide, "warning");
    return;
  }
  const annee = getAnnee();
  const notesPayload = aSauver.map((item) => ({
    noteId: item.noteId,
    eleveId: item.eleveId,
    type: canonical,
    periode: item.periode || gridForm.periode,
    note: item.note,
    matiere: item.matiere || gridForm.matiere || "",
    annee,
  }));

  // Hors-ligne connu d'avance → on met en file sans tenter l'appel.
  if (onQueued && typeof navigator !== "undefined" && navigator.onLine === false) {
    onQueued(notesPayload);
    toast("Hors-ligne : saisie mise en file, synchronisation auto au retour du réseau.", "warning");
    setModalNote(null);
    return;
  }

  setEnregistrement(true);
  setGridProgress({ done: 0, total: aSauver.length });
  try {
    // Un seul appel réseau : le serveur écrit toutes les notes en lot
    // (Firestore batch). Bien plus rapide que N requêtes séquentielles.
    const { ok, data } = await saveNotesApi(notesPayload);
    if (!ok) {
      const err = new Error(data.error || "Enregistrement impossible.");
      err.serverRejected = true; // réponse reçue → ce n'est PAS un souci réseau
      throw err;
    }
    const nbOk = Number(data.saved || 0);
    const nbKo = Number(data.failed || 0);
    setGridProgress({ done: nbOk, total: aSauver.length });
    await chargerPortail();
    if (nbKo === 0) {
      toast(`${nbOk} note(s) enregistrée(s).`, "success");
      onSuccess?.();
      setModalNote(null);
    } else {
      toast(`${nbOk} OK / ${nbKo} échec(s). Vérifie les lignes en rouge.`, "warning");
    }
  } catch (error) {
    // Échec réseau (fetch lève, pas de réponse serveur) → mise en file + retry auto.
    if (onQueued && !error.serverRejected) {
      onQueued(notesPayload);
      toast("Réseau indisponible : saisie mise en file, synchronisation auto au retour.", "warning");
      setModalNote(null);
    } else {
      toast(error.message || "Erreur d'enregistrement.", "error");
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
    const { ok, data } = await saveNoteApi({
      noteId: formNote.noteId,
      eleveId: formNote.eleveId,
      type: resolveCanonicalNoteType(formNote.type || defaultNoteType, schoolInfo, utilisateur.section || "secondaire"),
      periode: formNote.periode,
      note: Number(formNote.note),
      matiere: formNote.matiere || "",
      annee: getAnnee(),
    });
    if (!ok) throw new Error(data.error || "Enregistrement impossible.");
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
    const { ok, data } = await deleteNoteApi(noteId);
    if (!ok) throw new Error(data.error || "Suppression impossible.");
    await chargerPortail();
    toast("Note supprimee.", "success");
  } catch (error) {
    toast(error.message || "Erreur de suppression.", "error");
  } finally {
    setEnregistrement(false);
  }
}
