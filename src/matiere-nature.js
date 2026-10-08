// Nature d'une matière : ce qu'on ENSEIGNE (emploi du temps, cahier de
// textes) n'est pas toujours ce qu'on ÉVALUE (notes, moyennes, bulletins).
//  - « matiere »  : enseignée ET évaluée — le cas courant, et la nature de
//                   toute matière créée avant cette distinction ;
//  - « rubrique » : enseignée seulement (Vocabulaire, Orthographe,
//                   Conjugaison au primaire ; Français au collège) : à
//                   l'emploi du temps, jamais notée ni comptée dans une
//                   moyenne ;
//  - « epreuve »  : évaluée seulement (Dictée et Questions, Rédaction) :
//                   notée et au bulletin, absente de l'emploi du temps.
// `rattachement` (facultatif) nomme la discipline enseignée dont relève la
// matière (Dictée → Français) : au secondaire, le professeur de cette
// discipline peut la noter (cf. supabase/historique/matieres-rattachement.sql).
// Les deux champs vivent dans le jsonb `extra` : aucune colonne à ajouter.

export const NATURES_MATIERE = [
  {
    v: "matiere", icone: "📚", label: "Enseignée et évaluée",
    aide: "À l'emploi du temps, notée, comptée dans les moyennes et au bulletin.",
  },
  {
    v: "rubrique", icone: "🗓️", label: "Enseignée seulement",
    aide: "À l'emploi du temps uniquement : jamais notée, absente des moyennes et des bulletins (ex. Vocabulaire, Orthographe, Conjugaison, Français au collège).",
  },
  {
    v: "epreuve", icone: "📝", label: "Évaluée seulement",
    aide: "Notée, comptée dans les moyennes et au bulletin, mais absente de l'emploi du temps (ex. Dictée et Questions, Rédaction).",
  },
];

export const natureMatiere = (matiere) =>
  (matiere?.nature === "rubrique" || matiere?.nature === "epreuve" ? matiere.nature : "matiere");

export const estEvaluee = (matiere) => natureMatiere(matiere) !== "rubrique";
export const estEnseignee = (matiere) => natureMatiere(matiere) !== "epreuve";

export const matieresEvaluees = (matieres = []) => matieres.filter(estEvaluee);
export const matieresEnseignees = (matieres = []) => matieres.filter(estEnseignee);

// Champs de nature enregistrés avec la matière (formulaire de l'onglet Matières).
export const champsNature = (form = {}) => ({ nature: natureMatiere(form), rattachement: form.rattachement || "" });

// Même comparaison que la RLS : lower(btrim(…)).
const cleNom = (valeur) => String(valeur || "").trim().toLowerCase();

// Matières qu'un enseignant du secondaire peut noter : les matières évaluées
// qui portent le nom de SA matière, ou qui lui sont rattachées (professeur
// de Français → Dictée et Questions, Rédaction). Mêmes règles que
// teacher_can_write_note, pour ne jamais proposer une saisie que la base
// refuserait.
export function matieresNotablesPar(matieres = [], matiereEnseignant = "") {
  const cle = cleNom(matiereEnseignant);
  if (!cle) return [];
  return matieres.filter((m) => estEvaluee(m)
    && (cleNom(m.nom) === cle || cleNom(m.rattachement) === cle));
}
