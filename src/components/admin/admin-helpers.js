// Helpers partagés du panneau admin extraits de AdminPanel.jsx
// (découpage 2026-05-29).

// Rôles système que seul un superadmin/direction peut réinitialiser.
export const ROLES_SYSTEME_RESERVES = new Set(["direction", "admin", "comptable", "primaire", "college"]);

// Couleur de badge selon le rôle d'un compte.
export const compteColor = (role) =>
  role === "admin" ? "purple"
    : role === "comptable" ? "teal"
      : role === "direction" ? "blue"
        : "vert";
