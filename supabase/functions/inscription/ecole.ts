// ── Inscription d'une école : règles pures (tests/ecole-publique.test.js) ──
// Statut déclaré de l'établissement (étape 4, décisions du 2026-11-18) :
// « public » propose d'abord à l'école l'offre école publique (prix fixe
// quel que soit l'effectif). Il ne donne aucun droit : le plan reste attribué
// par EduGest (colonne `plan`, gardée par ecoles_guard). Toute autre valeur
// vaut « privé ».
export const statutEtablissement = (v: unknown): "public" | "prive" => (v === "public" ? "public" : "prive");
