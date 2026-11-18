import { identifiantConnexion } from "../../comptes-parents";

// Code école saisi à la connexion. L'espace d'un enseignant indépendant a
// pour code son numéro de téléphone : « 622 12 34 56 » ou « +224 622… »
// deviennent les 9 chiffres nationaux. Un code d'école ordinaire (il a des
// lettres) reste tel quel, en minuscules.
export const codeEcoleSaisi = (saisie) => identifiantConnexion(String(saisie ?? "").trim().toLowerCase());
