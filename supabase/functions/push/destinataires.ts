// ════════════════════════════════════════════════════════════════════════
//  push — à qui la notification part réellement
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (comme droits.ts) : index.ts l'importe, et les tests
// Node (tests/push-destinataires.test.js) le chargent tel quel.
//
// Les colonnes ecole_id / role / poste_cle de push_subs ont longtemps été
// écrites par le navigateur de l'abonné, sans contrôle : un parent pouvait
// s'inscrire « direction » d'une autre école. On ne s'y fie donc plus :
// chaque abonnement est rapproché du compte (`comptes`) de son user_id, et
// c'est ce compte qui décide de l'école, du rôle et de la clé de poste.

import { ROLES_HORS_PERSONNEL, type Demande } from "./droits.ts";

export type Abonnement = { user_id: string; ecole_id: string };

// Ligne `comptes` lue par index.ts (poste joint, fusion = extra->fusionneDans).
export type CompteAbonne = {
  user_id: string;
  role: string | null;
  ecole_id: string | null;
  statut: string | null;
  poste: { cle: string | null; actif: boolean | null } | null;
  fusion?: unknown;
};

// Clé de ciblage du compte : celle de son poste, sinon son rôle (comptes
// legacy ; les postes système portent les mêmes clés que les rôles). Parents
// et enseignants restent hors des postes, même si un poste_id traîne sur leur
// ligne — même règle que my_permissions() (postes.sql) et que le déclencheur
// push_subs_identite (push-subs-verrou.sql).
export function cleCiblage(compte: CompteAbonne): string {
  const role = compte.role || "";
  if (ROLES_HORS_PERSONNEL.includes(role)) return role;
  return compte.poste?.cle || role;
}

// Le compte peut-il recevoir les notifications de l'école `ecoleId` ?
// Il doit être actif (statut, poste, pas absorbé par une fusion de doublons —
// les mêmes refus qu'à la connexion, auth-supabase.js) et appartenir à
// l'école ; le superadmin, qui n'a pas d'école, reçoit partout.
export function compteJoignable(compte: CompteAbonne | undefined, ecoleId: string): boolean {
  if (!compte) return false;
  if (compte.statut && compte.statut !== "Actif") return false;
  if (compte.poste && compte.poste.actif === false) return false;
  if (compte.fusion) return false;
  if (compte.role === "superadmin") return true;
  return !!compte.ecole_id && compte.ecole_id === ecoleId;
}

// Abonnements à servir pour une demande déjà autorisée (droits.ts) :
// - `tousStaff` : tout le personnel (ni parent, ni enseignant) ;
// - sinon : rôle OU clé de poste dans `cibles` (les cibles historiques
//   'admin', 'direction'… matchent les postes système), OU user_id dans
//   `userIds` (messagerie) ;
// - la cible « parent » ne sert QUE les parents de l'élève concerné :
//   `parentsEleve`, les user_id des comptes rattachés à l'élève
//   (parent_eleves), lus par index.ts. Jamais tout le rôle : sans
//   `parentsEleve`, aucun parent.
export function destinataires<T extends Abonnement>(
  abonnements: T[], comptes: CompteAbonne[], ecoleId: string, demande: Demande, parentsEleve: string[] = [],
): T[] {
  const parUser = new Map(comptes.map((c) => [c.user_id, c]));
  const cibles = new Set(demande.cibles);
  const userIds = new Set(demande.userIds);
  const parents = new Set(parentsEleve);
  return abonnements.filter((a) => {
    if (a.ecole_id !== ecoleId) return false;
    const compte = parUser.get(a.user_id);
    if (!compte || !compteJoignable(compte, ecoleId)) return false;
    const role = compte.role || "";
    if (demande.tousStaff) return !ROLES_HORS_PERSONNEL.includes(role);
    if (userIds.has(a.user_id)) return true;
    if (role === "parent") return cibles.has("parent") && parents.has(a.user_id);
    return cibles.has(role) || cibles.has(cleCiblage(compte));
  });
}

// user_id dont lire les abonnements : si la demande ne vise que des
// personnes précises (messagerie, parents d'un élève), elles seules ; sinon
// (rôle ou poste du personnel, tousStaff) null = toute l'école.
export function candidats(demande: Demande, parentsEleve: string[] = []): string[] | null {
  if (demande.tousStaff || demande.cibles.some((c) => c !== "parent")) return null;
  const parents = demande.cibles.includes("parent") ? parentsEleve : [];
  return [...new Set([...demande.userIds, ...parents])];
}

// Découpe une liste en lots (filtres `in.(…)` : l'URL reste courte).
export function parLots<T>(liste: T[], taille: number): T[][] {
  const lots: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
}
