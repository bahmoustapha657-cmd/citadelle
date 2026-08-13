// Format d'impression des reçus — préférence de l'APPAREIL, pas de l'école :
// la caisse équipée d'un terminal thermique imprime en ticket 58 mm pendant
// que le bureau de la direction, même école, sort ses reçus en A4. D'où le
// localStorage plutôt qu'un champ dans `ecoles`.
const CLE = "LC_recuFormat";

export const FORMATS_RECU = [
  { id: "a4", icone: "📄", label: "A4 — 2 exemplaires", aide: "Imprimante bureau (comptable + payant)" },
  { id: "58", icone: "🧾", label: "Ticket 58 mm", aide: "Terminal POS / imprimante thermique" },
  { id: "80", icone: "🧾", label: "Ticket 80 mm", aide: "Imprimante de caisse large" },
];

export const getRecuFormat = () => {
  try {
    const v = localStorage.getItem(CLE);
    return FORMATS_RECU.some((f) => f.id === v) ? v : "a4";
  } catch { return "a4"; }
};

export const setRecuFormat = (id) => {
  try { localStorage.setItem(CLE, id); } catch { /* mode privé : on garde le défaut */ }
};

export const labelRecuFormat = (id) =>
  (FORMATS_RECU.find((f) => f.id === id) || FORMATS_RECU[0]).label;
