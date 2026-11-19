// ════════════════════════════════════════════════════════════════════════
//  Rattachement d'un espace enseignant à l'école qui adopte EduGest
// ════════════════════════════════════════════════════════════════════════
// Étape 3 (décisions du 2026-11-18) : l'ENSEIGNANT propose, depuis son
// espace, de rattacher ses classes à son école (il en saisit le code) ; la
// DIRECTION de l'école relie ses élèves aux siens et accepte. Ses notes,
// absences et appréciations passent alors chez l'école (migration
// 20261118180200, rattachement_appliquer), son compte enseignant y est créé
// ou relié, et son espace pour cet établissement est fermé.
//
// Sens unique entre écoles : de ses espaces enseignants, il passe à son
// compte de l'école ; jamais d'un compte d'école vers ses espaces, car la
// direction tient les comptes de son école (mot de passe, e-mail).
//
// Module SANS dépendance : index.ts l'importe, tests/rattachement.test.js le
// charge tel quel.

export type Refus = { error: string; status: number };

const SECTIONS = ["prescolaire", "primaire", "college", "lycee"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texte = (v: unknown) => String(v ?? "").trim();

export const normaliserCodeEcole = (code: unknown) => texte(code).toLowerCase();

// Changement d'espace vers une AUTRE école : seulement depuis un espace
// enseignant (le sien, même fermé), vers un autre de ses espaces enseignants
// ou vers son compte ENSEIGNANT dans une école où ses classes ont été
// rattachées. Même règle que mes_espaces().
export const passageEntreEcolesPermis = (typeAppelant: unknown, typeCible: unknown, roleCible: unknown) =>
  typeAppelant === "enseignant" && (typeCible === "enseignant" || roleCible === "enseignant");

// Demander ou annuler : l'enseignant, depuis son espace. Un espace déjà
// rattaché (fermé) ne redemande pas : ses classes sont chez l'école.
export function refusDemandeur(typeEspace: unknown, role: unknown, espaceActif: unknown = true): Refus | null {
  if (typeEspace !== "enseignant" || role !== "direction") {
    return { error: "Rattacher ses classes à une école se fait depuis l'espace d'un enseignant.", status: 403 };
  }
  if (espaceActif === false) return { error: "Cet espace est déjà rattaché à une école.", status: 409 };
  return null;
}

type EcoleVisee = { id?: string; type_espace?: unknown; actif?: unknown; supprime?: unknown } | null | undefined;

// École visée par le code saisi par l'enseignant.
export function refusEcoleVisee(ecole: EcoleVisee, espaceId: unknown): Refus | null {
  if (!ecole) return { error: "Aucune école ne porte ce code : demandez-le à la direction de votre école.", status: 404 };
  if (ecole.id === espaceId || ecole.type_espace === "enseignant") {
    return { error: "Ce code est celui d'un espace enseignant, pas d'une école.", status: 400 };
  }
  if (ecole.actif === false || ecole.supprime === true) {
    return { error: "Cette école n'est plus en service sur EduGest.", status: 409 };
  }
  return null;
}

type Demande = { ecole_id?: unknown; statut?: unknown } | null | undefined;

// Accepter ou refuser : la direction de l'école visée, et elle seule.
export function refusTraitement(demande: Demande, ecoleAppelant: unknown, role: unknown, typeEspace: unknown): Refus | null {
  if (role !== "direction" || typeEspace === "enseignant") {
    return { error: "Seule la direction de l'école traite une demande de rattachement.", status: 403 };
  }
  if (!demande || demande.ecole_id !== ecoleAppelant) return { error: "Demande introuvable.", status: 404 };
  if (demande.statut !== "en_attente") return { error: "Cette demande a déjà été traitée.", status: 409 };
  return null;
}

export type Acceptation = {
  eleves: Record<string, string>;
  matieres: Record<string, string>;
  classes: { section: string; classe: string }[];
  compteId: string | null;
  nouveau: { nom: string; prenom: string; section: string; matiere: string } | null;
};

// Corps d'une acceptation, nettoyé. Les élèves non reliés (valeur vide) sont
// laissés de côté ; il en faut au moins un relié, sinon c'est un refus.
export function validerAcceptation(corps: Record<string, unknown>): Refus | Acceptation {
  const eleves: Record<string, string> = {};
  const brut = corps.eleves && typeof corps.eleves === "object" ? corps.eleves as Record<string, unknown> : {};
  const cibles = new Set<string>();
  for (const [source, cible] of Object.entries(brut)) {
    const c = texte(cible);
    if (!c) continue;
    if (!UUID.test(source) || !UUID.test(c)) return { error: "Correspondance d'élèves invalide.", status: 400 };
    if (cibles.has(c)) return { error: "Deux élèves de l'enseignant sont reliés au même élève de l'école.", status: 400 };
    cibles.add(c);
    eleves[source] = c;
  }
  if (!Object.keys(eleves).length) {
    return { error: "Reliez au moins un élève de l'enseignant à un élève de l'école, ou refusez la demande.", status: 400 };
  }

  const matieres: Record<string, string> = {};
  const brutM = corps.matieres && typeof corps.matieres === "object" ? corps.matieres as Record<string, unknown> : {};
  for (const [source, cible] of Object.entries(brutM)) {
    const c = texte(cible);
    if (texte(source) && c) matieres[texte(source)] = c;
  }

  const classes: { section: string; classe: string }[] = [];
  const vues = new Set<string>();
  for (const x of Array.isArray(corps.classes) ? corps.classes : []) {
    const section = texte((x as Record<string, unknown>)?.section);
    const classe = texte((x as Record<string, unknown>)?.classe);
    if (!SECTIONS.includes(section) || !classe) return { error: "Classe de l'école invalide.", status: 400 };
    const cle = `${section}|${classe}`;
    if (!vues.has(cle)) { vues.add(cle); classes.push({ section, classe }); }
  }
  if (!classes.length) return { error: "Choisissez au moins une classe de l'école pour l'enseignant.", status: 400 };

  const compteId = texte(corps.compteId);
  if (compteId) {
    if (!UUID.test(compteId)) return { error: "Compte enseignant invalide.", status: 400 };
    return { eleves, matieres, classes, compteId, nouveau: null };
  }
  const n = corps.nouveau && typeof corps.nouveau === "object" ? corps.nouveau as Record<string, unknown> : {};
  const nouveau = { nom: texte(n.nom), prenom: texte(n.prenom), section: texte(n.section), matiere: texte(n.matiere) };
  if (!nouveau.nom) return { error: "Le nom de l'enseignant est requis pour créer son compte.", status: 400 };
  if (!SECTIONS.includes(nouveau.section)) return { error: "Choisissez la section de l'enseignant.", status: 400 };
  return { eleves, matieres, classes, compteId: null, nouveau };
}

// Erreur de rattachement_appliquer → statut HTTP. Les refus prévus portent
// un indice (hint) ; le reste est une panne.
const INDICES_CONFLIT = new Set(["deja_traitee", "espace_ferme", "ecole_hors_service"]);
export function statutErreurApplication(hint: unknown, code: unknown): number {
  if (INDICES_CONFLIT.has(String(hint))) return 409;
  if (code === "P0001" || code === "P0002") return 400;
  return 500;
}
