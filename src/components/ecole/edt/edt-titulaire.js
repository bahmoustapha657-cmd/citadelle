// Primaire et maternelle : un TITULAIRE tient la classe et enseigne presque
// toutes les matières ; seules quelques-unes sont confiées à un intervenant
// (anglais, EPS, arabe…). Au secondaire, au contraire, chaque matière a son
// professeur. L'emploi du temps en tient compte : le titulaire est attribué
// d'office aux créneaux de sa classe, au lieu de devoir le choisir à chaque
// case.

export const sectionATitulaire = (section) => section === "primaire" || section === "prescolaire";

const norm = (v) => String(v || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ");

// Les créneaux anciens portent parfois « Prénom Nom (Matière) ».
const sansSuffixe = (v) => String(v || "").replace(/\s*\([^)]*\)\s*$/, "").trim();

export const nomEnseignant = (e) => `${e?.prenom || ""} ${e?.nom || ""}`.trim();

export const memeEnseignant = (a, b) => {
  const na = norm(sansSuffixe(a));
  return !!na && na === norm(sansSuffixe(b));
};

// Titulaire d'une classe, tel qu'il s'écrit sur les créneaux (« Prénom Nom »),
// ou "" s'il n'est pas désigné. La fiche enseignant (« Classe titulaire »)
// prime : c'est elle qui ouvre au titulaire ses élèves dans le portail. À
// défaut, l'« Enseignant principal » saisi sur la classe.
export function titulaireDeClasse(classe, ens = [], classes = []) {
  const cible = norm(classe);
  if (!cible) return "";
  const fiche = ens.find((e) => norm(e.classeTitle) === cible);
  if (fiche) return nomEnseignant(fiche);
  const principal = sansSuffixe(classes.find((c) => norm(c.nom) === cible)?.enseignant);
  if (!principal) return "";
  // Recalé sur la fiche quand elle existe (casse, accents) pour que le
  // sélecteur d'enseignant la reconnaisse.
  const connu = ens.find((e) => memeEnseignant(nomEnseignant(e), principal));
  return connu ? nomEnseignant(connu) : principal;
}

// Enseignant proposé d'office pour un créneau de la classe : celui qui assure
// déjà cette matière dans la classe (l'intervenant d'anglais reste
// l'intervenant d'anglais), sinon le titulaire.
export function enseignantParDefaut({ emploisClasse = [], matiere = "", titulaire = "", exclureId = null }) {
  if (matiere) {
    const compte = new Map();
    for (const e of emploisClasse) {
      if (e._id === exclureId || e.type === "recreation" || e.matiere !== matiere || !e.enseignant) continue;
      compte.set(e.enseignant, (compte.get(e.enseignant) || 0) + 1);
    }
    const [plusFrequent] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (plusFrequent) return plusFrequent;
  }
  return titulaire;
}

// Créneaux de la classe qui ne sont pas (ou plus) tenus par le titulaire,
// regroupés par enseignant : sans enseignant, ancien titulaire, intervenant.
// Sert au bandeau qui propose de les lui confier.
export function creneauxHorsTitulaire(emploisClasse = [], titulaire = "") {
  const groupes = new Map();
  for (const e of emploisClasse) {
    if (e.type === "recreation") continue;
    if (titulaire && memeEnseignant(e.enseignant, titulaire)) continue;
    const cle = sansSuffixe(e.enseignant);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(e);
  }
  return [...groupes.entries()]
    .map(([enseignant, creneaux]) => ({ enseignant, creneaux }))
    .sort((a, b) => (a.enseignant ? 1 : 0) - (b.enseignant ? 1 : 0) || b.creneaux.length - a.creneaux.length);
}

// Copie de l'EDT d'une classe vers une autre : les créneaux du titulaire de la
// classe source passent au titulaire de la classe cible (sinon, sans
// enseignant) — copier tel quel mettait le même maître dans deux classes à
// la même heure. Les intervenants sont gardés.
export function creneauxCopies(emploisSource = [], { dest, titulaireSource = "", titulaireDest = "" }) {
  return emploisSource.map((e) => {
    const copie = {
      ...e,
      classe: dest,
      ...(titulaireSource && memeEnseignant(e.enseignant, titulaireSource) ? { enseignant: titulaireDest } : {}),
    };
    delete copie._id;
    return copie;
  });
}
