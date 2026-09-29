// ════════════════════════════════════════════════════════════════════════
//  EduGest — Comptes parents : téléphone des comptes existants
// ════════════════════════════════════════════════════════════════════════
// Logique pure de telephones-parents.mjs. Aucun effet à l'import : les tests
// (tests/comptes-parents.test.js) la chargent sans base.
import { normaliserTelGuinee } from "../shared/phone.js";

// Téléphone d'un compte parent qui n'en a pas encore : celui de son profil
// (extra.contactTuteur), sinon celui des fiches de ses enfants s'ils portent
// un seul et même numéro. Plusieurs numéros différents : on ne devine pas.
// Renvoie { telephone, source } — source : profil | enfants | ambigu | aucun.
export function telephoneDuCompte(compte, contactsEnfants = []) {
  const propre = normaliserTelGuinee(compte.extra?.contactTuteur);
  if (propre) return { telephone: propre, source: "profil" };
  const numeros = [...new Set(contactsEnfants.map(normaliserTelGuinee).filter(Boolean))];
  if (numeros.length === 1) return { telephone: numeros[0], source: "enfants" };
  return { telephone: null, source: numeros.length ? "ambigu" : "aucun" };
}

// Numéros portés par plusieurs comptes parents : doublons probables (même
// parent, plusieurs comptes — à fusionner), ou numéro vraiment partagé
// (celui de l'école saisi pour des internes). À examiner, jamais fusionné
// d'office.
export function numerosPartages(comptes) {
  const parNumero = new Map();
  for (const c of comptes) {
    if (!c.telephone) continue;
    parNumero.set(c.telephone, [...(parNumero.get(c.telephone) || []), c]);
  }
  return [...parNumero.entries()]
    .filter(([, liste]) => liste.length > 1)
    .map(([telephone, liste]) => ({ telephone, comptes: liste }));
}
