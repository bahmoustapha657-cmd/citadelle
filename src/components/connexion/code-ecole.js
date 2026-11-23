import { identifiantConnexion } from "../../comptes-parents";

// Code école saisi à la connexion. L'espace d'un enseignant indépendant a
// pour code son numéro de téléphone : « 622 12 34 56 » ou « +224 622… »
// deviennent les 9 chiffres nationaux. Un code d'école ordinaire (il a des
// lettres) reste tel quel, en minuscules et sans accents : le code court
// d'une école (un mot de son nom) se tape comme on l'entend, « Baobab » ou
// « baôbab ». Même règle que normaliser_code_ecole côté base.
const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const codeEcoleSaisi = (saisie) =>
  identifiantConnexion(sansAccents(String(saisie ?? "").trim().toLowerCase()));
