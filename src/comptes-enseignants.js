// ── Comptes enseignants : identifiant = téléphone ou e-mail ────────────────
// Module PUR (tests/comptes-enseignants.test.js). Un nouveau compte
// enseignant se connecte avec son NUMÉRO ou son ADRESSE E-MAIL, plus avec un
// identifiant inventé (« jean.dupont ») qu'il oubliait. Les comptes déjà
// créés gardent leur identifiant.
//
// Côté serveur, rien de neuf :
//  - numéro : il DEVIENT l'identifiant (9 chiffres) ; la connexion accepte
//    déjà « 622 12 34 56 », « +224 622… » (auth-supabase.js, ecoleLogin) ;
//  - e-mail : enregistré dans comptes.email, la connexion le résout via la
//    RPC login_pour_email, et « Mot de passe oublié » y envoie le lien.
import { numeroNational, slugLogin } from "./comptes-parents.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// E-mail normalisé (minuscules, sans espaces) ou null s'il est vide.
export const normaliserEmail = (brut) => String(brut ?? "").trim().toLowerCase() || null;

// null si l'e-mail est vide ou valide, sinon le message d'erreur.
export function erreurEmail(brut) {
  const email = normaliserEmail(brut);
  return email && !EMAIL_RE.test(email) ? "Adresse e-mail invalide (ex : prenom.nom@gmail.com)." : null;
}

// Numéro (9 chiffres) et e-mail lus sur la fiche de l'enseignant.
export function coordonneesEnseignant(ens = {}) {
  const email = normaliserEmail(ens.email);
  return {
    telephone: numeroNational(ens.telephone) || numeroNational(ens.contact),
    email: email && EMAIL_RE.test(email) ? email : null,
  };
}

// Modes d'identifiant proposés, le téléphone d'abord (le plus courant).
export function modesIdentifiant(ens) {
  const { telephone, email } = coordonneesEnseignant(ens);
  return [telephone && "telephone", email && "email"].filter(Boolean);
}

// Identifiant interne du compte selon le mode choisi :
//  - téléphone : le numéro lui-même, ce que l'enseignant tapera ;
//  - e-mail    : l'e-mail ne peut pas servir d'identifiant interne (il entre
//    dans l'adresse technique du compte), on en tire un identifiant stable et
//    unique dans l'école (comptes.email l'est déjà) ; l'enseignant, lui, tape
//    son e-mail.
export function loginEnseignant(mode, ens) {
  const { telephone, email } = coordonneesEnseignant(ens);
  if (mode === "telephone") return telephone || "";
  if (mode === "email") return email ? `ens.${slugLogin(email)}`.slice(0, 60) : "";
  return "";
}

// Ce que l'enseignant tapera pour se connecter (affiché à la création).
export function identifiantAffiche(mode, ens) {
  const { telephone, email } = coordonneesEnseignant(ens);
  return mode === "telephone" ? telephone || "" : mode === "email" ? email || "" : "";
}

// Identifiant interne d'un espace enseignant RELIÉ à un compte qui utilise
// déjà ce numéro (même personne, déjà parent ou personnel) : la personne se
// connecte avec son numéro sur l'autre compte, puis bouton « Espace ».
export const loginInterneEnseignant = (login) =>
  (String(login).startsWith("ens.") ? `${login}.ens` : `ens.${login}`);
