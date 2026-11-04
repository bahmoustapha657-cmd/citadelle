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
import i18n from "../../i18n";

// Ré-export pour préserver le point d'import unique du parent.
export { construireGrille };

// Enregistre la grille complète (1 requête API par cellule non vide).
// Met à jour gridProgress en cours pour afficher la progression.
export async function enregistrerGrille({
  gridForm,
  mesNotes,
  schoolInfo,
  utilisateur,
  maxNote = 20,
  annee: anneeEcole = "",
  setEnregistrement,
  setGridProgress,
  setModalNote,
  chargerPortail,
  toast,
  onSuccess,
  onQueued,
  onSavedNotes,
}) {
  const { canonical, aSauver } = collectGridNotes({ gridForm, mesNotes, schoolInfo, utilisateur });
  const invalide = validateGridNotes(aSauver, maxNote);
  if (invalide) {
    toast(invalide, "warning");
    return;
  }
  // L'année de l'école, celle des notes affichées ; le cache de l'appareil
  // ne sert qu'en dernier recours.
  const annee = anneeEcole || getAnnee();
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
    toast(i18n.t("teacher.notes.offlineQueued"), "warning");
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
      const err = new Error(data.error || i18n.t("teacher.notes.saveFailed"));
      err.serverRejected = true; // réponse reçue → ce n'est PAS un souci réseau
      throw err;
    }
    const nbOk = Number(data.saved || 0);
    const nbKo = Number(data.failed || 0);
    setGridProgress({ done: nbOk, total: aSauver.length });
    if (nbKo === 0 && onSavedNotes && Array.isArray(data.notes)) {
      // Mise à jour LOCALE de l'état (le serveur a renvoyé les notes écrites +
      // leurs IDs) → PAS de rechargement complet du portail = lectures
      // Firestore économisées à chaque enregistrement.
      onSavedNotes(data.notes);
      toast(i18n.t("teacher.notes.savedCount", { count: nbOk }), "success");
      onSuccess?.();
      setModalNote(null);
    } else {
      // Échec partiel (ou pas de retour serveur) : rechargement de sécurité.
      await chargerPortail();
      if (nbKo === 0) {
        toast(i18n.t("teacher.notes.savedCount", { count: nbOk }), "success");
        onSuccess?.();
        setModalNote(null);
      } else {
        toast(i18n.t("teacher.notes.partial", { ok: nbOk, ko: nbKo }), "warning");
      }
    }
  } catch (error) {
    // Échec réseau (fetch lève, pas de réponse serveur) → mise en file + retry auto.
    if (onQueued && !error.serverRejected) {
      onQueued(notesPayload);
      toast(i18n.t("teacher.notes.networkQueued"), "warning");
      setModalNote(null);
    } else {
      toast(error.message || i18n.t("teacher.notes.saveError"), "error");
    }
  } finally {
    setEnregistrement(false);
  }
}

// Enregistre une note individuelle (création ou édition selon noteId).
export async function enregistrerNote({
  formNote, defaultNoteType, schoolInfo, utilisateur, maxNote = 20, annee = "",
  setEnregistrement, setModalNote, chargerPortail, toast,
}) {
  if (!formNote.eleveId || formNote.note === "" || !formNote.periode) {
    toast(i18n.t("teacher.notes.required"), "warning");
    return;
  }
  // Même borne que la grille : sans elle, la saisie unitaire acceptait
  // n'importe quelle valeur (15 au primaire, 25 au secondaire).
  const invalide = validateGridNotes([{ note: Number(formNote.note) }], maxNote);
  if (invalide) {
    toast(invalide, "warning");
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
      annee: annee || getAnnee(),
    });
    if (!ok) throw new Error(data.error || i18n.t("teacher.notes.saveFailed"));
    setModalNote(null);
    await chargerPortail();
    toast(i18n.t("teacher.notes.saved"), "success");
  } catch (error) {
    toast(error.message || i18n.t("teacher.notes.saveError"), "error");
  } finally {
    setEnregistrement(false);
  }
}

// Supprime une note avec confirmation.
export async function supprimerNote(noteId, { setEnregistrement, chargerPortail, toast }) {
  if (!noteId || !window.confirm(i18n.t("teacher.notes.deleteConfirm"))) return;
  setEnregistrement(true);
  try {
    const { ok, data } = await deleteNoteApi(noteId);
    if (!ok) throw new Error(data.error || i18n.t("teacher.notes.deleteFailed"));
    await chargerPortail();
    toast(i18n.t("teacher.notes.deleted"), "success");
  } catch (error) {
    toast(error.message || i18n.t("teacher.notes.deleteError"), "error");
  } finally {
    setEnregistrement(false);
  }
}
