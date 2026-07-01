import { useState } from "react";
import { genererAppreciation } from "../../../backend/ia";
import { getGeneralAverage, getSubjectAverage } from "../../../note-utils";

// Mention à partir de la moyenne générale (identique à BulletinsTable).
const mentionFor = (moy) =>
  moy === "—" ? "—"
    : Number(moy) >= 16 ? "Très Bien"
    : Number(moy) >= 14 ? "Bien"
    : Number(moy) >= 12 ? "Assez Bien"
    : Number(moy) >= 10 ? "Passable"
    : "Insuffisant";

// Génération d'appréciations IA EN LOT pour les élèves affichés (sélecteur de
// classe + recherche). Ne modifie jamais une appréciation déjà saisie. Appels
// séquentiels pour ménager l'API. Marche sur Firebase ET Supabase, car
// genererAppreciation aiguille tout seul (voir src/backend/ia.js).
export function useBatchAppreciation({
  elevesB, notes, matieresForClasse, periodeB,
  getAppreciation, saveAppreciation, toast,
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const lancer = async () => {
    if (running) return;
    // Cibles = élèves affichés sans appréciation pour la période courante.
    const cibles = elevesB.filter((e) => !getAppreciation(e._id, periodeB)?.texte);
    if (cibles.length === 0) {
      toast?.("Tous les élèves affichés ont déjà une appréciation pour cette période.", "info");
      return;
    }
    if (!window.confirm(
      `Générer une appréciation par IA pour ${cibles.length} élève(s) sans appréciation (${periodeB}) ?\n`
      + "Les appréciations déjà saisies ne seront pas modifiées. L'opération peut prendre un moment.",
    )) return;

    setRunning(true);
    setProgress({ done: 0, total: cibles.length });
    let ok = 0, echecs = 0, vides = 0;

    for (let i = 0; i < cibles.length; i++) {
      const e = cibles[i];
      const mats = matieresForClasse(e.classe);
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periodeB);
      const notesMatieres = mats
        .map((m) => ({ matiere: m.nom, moyenne: getSubjectAverage(notesE.filter((n) => n.matiere === m.nom), e.classe) }))
        .filter((x) => x.moyenne != null);

      // Pas de note = rien à apprécier : on ignore (évite un appel API inutile).
      if (notesMatieres.length === 0) {
        vides++;
        setProgress({ done: i + 1, total: cibles.length });
        continue;
      }

      const moyG = getGeneralAverage(notesE, mats, e.classe);
      const moyGene = moyG != null ? moyG.toFixed(2) : "—";
      try {
        const { ok: r, result } = await genererAppreciation({
          nom: `${e.nom} ${e.prenom}`, classe: e.classe, periode: periodeB,
          moyenne: moyGene, mention: mentionFor(moyGene), notesMatieres, consigne: "",
        });
        if (r && result) { await saveAppreciation(e._id, periodeB, result); ok++; }
        else echecs++;
      } catch {
        echecs++;
      }
      setProgress({ done: i + 1, total: cibles.length });
    }

    setRunning(false);
    const parts = [`${ok} générée(s)`];
    if (echecs) parts.push(`${echecs} échec(s)`);
    if (vides) parts.push(`${vides} sans notes ignoré(s)`);
    toast?.(`Appréciations IA : ${parts.join(", ")}.`, echecs ? "warning" : "success");
  };

  return { running, progress, lancer };
}
