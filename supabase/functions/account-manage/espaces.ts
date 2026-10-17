// ── Une personne, plusieurs espaces ────────────────────────────────────────
// Règles PURES (testées par tests/espaces-multiples.test.js) des actions
// relier_comptes / detacher_compte / changer_espace d'account-manage.
// Les comptes d'une même personne partagent comptes.personne_id ; la base
// refuse que quiconque d'autre que le service_role l'écrive
// (migration 20261017094006_espaces_multiples.sql).

export type CompteLie = {
  id: string;
  ecole_id: string | null;
  user_id?: string | null;
  role: string;
  personne_id?: string | null;
  extra?: Record<string, unknown> | null;
};

// Relier ou détacher : la Direction seulement (choix de l'école,
// 2026-10-17), et le superadmin EduGest.
export const peutRelierComptes = (role: string) => role === "direction" || role === "superadmin";

type Refus = { error: string; status: number };

// Contrôle d'une demande de liaison. Renvoie le personne_id à poser sur
// tous les comptes : celui d'un groupe déjà existant (on y ajoute les autres),
// sinon `nouvelId`.
export function planLiaison(
  comptes: CompteLie[], idsDemandes: string[], ecoleId: string, nouvelId: string,
): { personneId: string } | Refus {
  const ids = [...new Set(idsDemandes.map(String).filter(Boolean))];
  if (ids.length < 2) return { error: "Choisissez au moins deux comptes à relier.", status: 400 };
  if (comptes.length !== ids.length) return { error: "Compte introuvable.", status: 404 };
  for (const c of comptes) {
    if (c.ecole_id !== ecoleId) return { error: "Compte introuvable pour cette école.", status: 404 };
    if (c.role === "superadmin") return { error: "Ce compte ne peut pas être relié.", status: 400 };
    if (!c.user_id) return { error: "Un des comptes n'a pas d'accès de connexion.", status: 409 };
    if (c.extra?.fusionneDans) return { error: "Un des comptes a été regroupé avec un autre : il n'est plus actif.", status: 409 };
  }
  const groupes = [...new Set(comptes.map((c) => c.personne_id).filter(Boolean))] as string[];
  if (groupes.length > 1) {
    return { error: "Ces comptes sont déjà reliés à des personnes différentes : détachez-les d'abord.", status: 409 };
  }
  return { personneId: groupes[0] || nouvelId };
}

// Passage d'un compte à un autre : uniquement vers un compte RELIÉ au compte
// connecté, de la même école, actif et doté d'un accès de connexion.
export function refusChangement(appelant: CompteLie, cible: CompteLie | null): Refus | null {
  if (!cible) return { error: "Espace introuvable.", status: 404 };
  if (cible.id === appelant.id) return { error: "Vous êtes déjà dans cet espace.", status: 400 };
  if (!appelant.personne_id || cible.personne_id !== appelant.personne_id || cible.ecole_id !== appelant.ecole_id) {
    return { error: "Cet espace n'est pas relié à votre compte.", status: 403 };
  }
  if (!cible.user_id) return { error: "Cet espace n'a pas d'accès de connexion.", status: 409 };
  if (cible.extra?.fusionneDans) return { error: "Cet espace n'est plus actif.", status: 409 };
  return null;
}

// Détacher un compte : si son groupe n'en garde qu'un, ce dernier est
// détaché aussi (un « groupe » d'un seul compte n'a pas de sens).
export function idsADetacher(compte: CompteLie, groupe: CompteLie[]): string[] {
  if (!compte.personne_id) return [];
  const restants = groupe.filter((c) => c.personne_id === compte.personne_id && c.id !== compte.id);
  return restants.length === 1 ? [compte.id, restants[0].id] : [compte.id];
}
