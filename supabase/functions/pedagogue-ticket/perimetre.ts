// ── Ce que Pédagogue reçoit de l'enseignant : ses classes, matières et séances ──
// Règles PURES (testées par tests/pedagogue-ticket.test.js). Même périmètre que
// le portail enseignant (fetchTeacherPortal, src/backend/teacher-scope.js) : une
// fonction Edge n'importe pas src/, qui lit le navigateur. Jamais d'élève, de
// note ni de salaire ici : seuls ces champs quittent EduGest.

type Extra = Record<string, unknown> | null | undefined;

export type CompteEnseignant = {
  nom?: string | null;
  enseignant_nom?: string | null;
  enseignant_id?: string | null;
  section?: string | null;
  sections?: string[] | null;
  matiere?: string | null;
  extra?: Extra;
};

export type LigneEmploi = {
  classe?: string | null;
  jour?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  matiere?: string | null;
  enseignant?: string | null;
  extra?: Extra;
};

export type LigneEnseignement = { classe?: string | null; enseignant_nom?: string | null };

export type LigneFiche = {
  id: string;
  nom?: string | null;
  prenom?: string | null;
  classe_title?: string | null;
  extra?: Extra;
};

export type LigneClasse = { nom?: string | null; enseignant_id?: string | null };

export type LigneMatiere = { nom?: string | null; classes?: string[] | null; extra?: Extra };

export type CreneauPedagogue = { jour: number; debut: string; fin: string; matiere: string };
export type ClassePedagogue = { nom: string; section: string; matieres: string[]; creneaux: CreneauPedagogue[] };

const SECTIONS = ["prescolaire", "primaire", "college", "lycee"];
const JOURS: Record<string, number> = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

const normaliser = (valeur: unknown) =>
  String(valeur || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const sansSuffixe = (valeur: unknown) => String(valeur || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
const texte = (valeur: unknown) => String(valeur || "").trim();

// Comme normalizeSection : « secondaire » et l'inconnu valent collège.
export function sectionDuCompte(compte: CompteEnseignant): string {
  const s = texte(compte.section || compte.sections?.[0]).toLowerCase();
  return SECTIONS.includes(s) ? s : "college";
}

function correspond(valeur: unknown, alias: string[]): boolean {
  const cherche = normaliser(sansSuffixe(valeur));
  return !!cherche && alias.some((a) => normaliser(sansSuffixe(a)) === cherche);
}

// « 8h », « 08h30 », « 08:00:00 » → « HH:MM » ; sinon vide.
function heure(valeur: unknown): string {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(String(valeur || ""));
  if (!m || Number(m[1]) > 23) return "";
  return `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
}

function creneau(ligne: LigneEmploi): CreneauPedagogue | null {
  // Anciennes saisies : un seul champ `heure` (« 08:00 - 10:00 »).
  const [debut, fin] = ligne.heure_debut
    ? [ligne.heure_debut, ligne.heure_fin]
    : String(ligne.extra?.heure || "").split(/\s*[-–à]\s*/);
  const jour = JOURS[normaliser(ligne.jour)];
  const matiere = texte(ligne.matiere);
  if (!jour || !heure(debut) || !matiere) return null;
  return { jour, debut: heure(debut), fin: heure(fin), matiere };
}

// Une matière sans classe vaut pour toutes ; « 4ème Année » couvre « 4ème Année A ».
function concerne(matiere: LigneMatiere, classe: string): boolean {
  if (!matiere.classes?.length) return true;
  const c = normaliser(classe);
  return matiere.classes.some((x) => {
    const n = normaliser(x);
    return n === c || n.startsWith(`${c} `) || c.startsWith(`${n} `);
  });
}

export function classesDeLEnseignant({ compte, emplois, enseignements, fiches, classes, matieres }: {
  compte: CompteEnseignant;
  emplois: LigneEmploi[];
  enseignements: LigneEnseignement[];
  fiches: LigneFiche[];
  classes: LigneClasse[];
  matieres: LigneMatiere[];
}): ClassePedagogue[] {
  const section = sectionDuCompte(compte);
  const alias = [...new Set([compte.enseignant_nom, compte.nom].map(texte).filter(Boolean))];
  const mesEmplois = emplois.filter((e) => correspond(e.enseignant, alias));
  const mesFiches = fiches.filter((f) =>
    (compte.enseignant_id && f.id === compte.enseignant_id)
    || correspond(`${f.nom || ""} ${f.prenom || ""}`, alias)
    || correspond(f.nom, alias));

  const noms = [
    ...mesEmplois.map((e) => e.classe),
    ...enseignements.filter((e) => correspond(e.enseignant_nom, alias)).map((e) => e.classe),
    ...mesFiches.flatMap((f) => [f.classe_title, f.extra?.classeTitle, f.extra?.classeTitre, f.extra?.classe]),
    ...classes.filter((c) => c.enseignant_id && c.enseignant_id === compte.enseignant_id).map((c) => c.nom),
    compte.extra?.classeTitre,
    compte.extra?.classe,
    ...(Array.isArray(compte.extra?.classesTitulaire) ? compte.extra.classesTitulaire : []),
  ].map(texte).filter(Boolean);
  const uniques = [...new Map(noms.map((n) => [normaliser(n), n])).values()];

  // Maternelle et primaire : le titulaire enseigne tout. Secondaire : ses matières.
  const titulaire = section === "prescolaire" || section === "primaire";
  return uniques.map((nom) => {
    const seances = mesEmplois.filter((e) => normaliser(e.classe) === normaliser(nom));
    const dela = titulaire
      ? matieres.filter((m) => m.extra?.nature !== "epreuve" && concerne(m, nom)).map((m) => m.nom)
      : [...seances.map((e) => e.matiere), compte.matiere];
    return {
      nom,
      section,
      matieres: [...new Set(dela.map(texte).filter(Boolean))],
      creneaux: seances.flatMap((e) => creneau(e) ?? []),
    };
  });
}
