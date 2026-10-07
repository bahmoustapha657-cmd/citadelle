// ── Notes ↔ fiches élèves ──────────────────────────────────────────────────
// La table Supabase `notes` ne porte que eleve_id (NOT NULL) : aucun nom. Le
// nom affiché (liste et export Excel de l'École, portail enseignant) vient de
// la fiche, par la même jointure que les absences (fiche-eleve.js). Les notes
// Firestore d'avant la migration portaient eleveNom, parfois sans eleveId : il
// reste un repli.
import { completerDepuisFiches, nomEleve } from "./fiche-eleve.js";

// `eleves` doit inclure les élèves partis, pour que leurs notes passées
// gardent un nom.
export const enrichirNotes = (notes = [], eleves = []) => completerDepuisFiches(notes, eleves);

// Options du sélecteur d'élève de la saisie d'une note. La valeur est
// l'identifiant : choisi par son nom, l'élève était retrouvé par
// eleves.find(nom) et la note de l'homonyme partait au premier de la liste.
// Le libellé porte la classe, puis le matricule si deux élèves partagent
// encore nom et classe — sans quoi on ne saurait lequel choisir.
export function optionsEleves(eleves = []) {
  const libelle = (e) => [nomEleve(e), e.classe].filter(Boolean).join(" — ");
  const vus = new Map();
  for (const e of eleves) vus.set(libelle(e), (vus.get(libelle(e)) || 0) + 1);
  return eleves.filter((e) => e?._id).map((e) => {
    const base = libelle(e);
    return { value: e._id, label: vus.get(base) > 1 && e.matricule ? `${base} (${e.matricule})` : base };
  });
}

// Une note sans élève ou sans matière est refusée par la base (eleve_id et
// matiere NOT NULL) : en ligne l'insertion échoue, et sous PowerSync le refus
// arrive à l'envoi, où le connecteur jette l'écriture — la note disparaît à
// la synchro suivante.
export const notePrete = (form) => Boolean(form?.eleveId && form?.matiere);
