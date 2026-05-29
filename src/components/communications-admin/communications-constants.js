// Rôles ciblables — jamais "parent" ni "superadmin".
export const ROLES_CIBLABLES = [
  { id: "direction", label: "Direction" },
  { id: "admin", label: "Admin" },
  { id: "comptable", label: "Comptabilité" },
  { id: "primaire", label: "Primaire" },
  { id: "college", label: "Collège / Lycée" },
  { id: "enseignant", label: "Enseignant" },
];

export const NIVEAUX = [
  { id: "info", label: "Info", couleur: "#0369a1", bg: "#e0f2fe" },
  { id: "important", label: "Important", couleur: "#a16207", bg: "#fef3c7" },
  { id: "critique", label: "Critique", couleur: "#991b1b", bg: "#fee2e2" },
];
