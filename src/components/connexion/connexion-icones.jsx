// Icônes trait (24×24, currentColor) de l'écran de connexion.
const trait = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};

export const IconeEcole = (p) => (
  <svg {...trait} {...p}><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M10 21v-5h4v5" /></svg>
);
export const IconeUtilisateur = (p) => (
  <svg {...trait} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconeCadenas = (p) => (
  <svg {...trait} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconeOeil = (p) => (
  <svg {...trait} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconeOeilBarre = (p) => (
  <svg {...trait} {...p}><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.4" /><path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M2 2l20 20" /></svg>
);
export const IconeAlerte = (p) => (
  <svg {...trait} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
);
export const IconeCoche = (p) => (
  <svg {...trait} strokeWidth={3} {...p}><path d="M5 12l5 5L20 7" /></svg>
);
export const IconePlus = (p) => (
  <svg {...trait} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
export const IconeInfo = (p) => (
  <svg {...trait} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
);
