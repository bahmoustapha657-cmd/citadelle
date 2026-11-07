// ════════════════════════════════════════════════════════════════════════
//  rappel-reinscriptions — qui reçoit le rappel, et pour quelle année
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (comme push/destinataires.ts) : index.ts l'importe,
// les tests Node (tests/rappel-reinscriptions-cibles.test.js) le chargent tel quel.

import { type CompteAbonne, compteJoignable } from "../push/destinataires.ts";

export type Abonnement = { user_id: string; ecole_id: string };

// Compte lu par index.ts : le poste porte sa carte de permissions.
export type CompteCompta = Omit<CompteAbonne, "poste"> & {
  poste: { cle: string | null; actif: boolean | null; permissions?: Record<string, unknown> | null } | null;
};

// Le compte tient-il la comptabilité ? Compte à poste : écriture « compta »
// (même règle que has_module_write('compta') et que la cloche de l'app) ;
// compte sans poste (legacy) : le rôle comptable. Jamais un parent, un
// enseignant, ni le superadmin (aucune école à lui).
export function ecritCompta(compte: CompteCompta): boolean {
  const role = compte.role || "";
  if (["parent", "enseignant", "superadmin"].includes(role)) return false;
  if (compte.poste) return compte.poste.permissions?.compta === "ecriture";
  return role === "comptable";
}

// Abonnements des comptables de l'école `ecoleId` encore joignables (compte
// actif, poste actif, pas absorbé par une fusion de doublons).
export function abonnementsComptables<T extends Abonnement>(abonnements: T[], comptes: CompteCompta[], ecoleId: string): T[] {
  const parUser = new Map(comptes.map((c) => [c.user_id, c]));
  return abonnements.filter((a) => {
    const compte = parUser.get(a.user_id);
    return a.ecole_id === ecoleId && !!compte
      && compteJoignable(compte as unknown as CompteAbonne, ecoleId) && ecritCompta(compte);
  });
}

// Année scolaire d'une date : septembre l'ouvre (comme anneeScolaireDeDate).
export function anneeDuJour(d: Date): string {
  const an = d.getUTCFullYear();
  return d.getUTCMonth() >= 8 ? `${an}-${an + 1}` : `${an - 1}-${an}`;
}

// Réglages de l'école utiles à la règle, avec les mêmes replis que l'app
// (mergeSchoolInfo : rentrée en octobre ; année du jour si l'école n'a jamais
// enregistré la sienne).
export function infoEcole(extra: Record<string, unknown> | null | undefined, maintenant: Date) {
  const x = extra || {};
  return {
    anneeScolaire: typeof x.anneeScolaire === "string" && x.anneeScolaire ? x.anneeScolaire : anneeDuJour(maintenant),
    moisDebut: typeof x.moisDebut === "string" && x.moisDebut ? x.moisDebut : "Octobre",
    retraitNonReinscrits: x.retraitNonReinscrits,
  };
}

// Comparaison à durée constante du secret de la tâche planifiée.
export function secretValide(recu: string | null | undefined, attendu: string | null | undefined): boolean {
  if (!recu || !attendu || recu.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= recu.charCodeAt(i) ^ attendu.charCodeAt(i);
  return diff === 0;
}
