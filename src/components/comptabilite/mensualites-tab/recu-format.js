// Format d'impression des reçus — préférence de l'APPAREIL, pas de l'école :
// la caisse équipée d'un terminal thermique imprime en ticket 58 mm pendant
// que le bureau de la direction, même école, sort ses reçus en A4. D'où le
// localStorage plutôt qu'un champ dans `ecoles`.
import i18n from "../../../i18n";

const CLE = "LC_recuFormat";

// Libellés lus à l'affichage (langue courante).
const formatRecu = (id, icone, cle) => ({
  id, icone,
  get label() { return i18n.t(`accounting.receiptFormat.${cle}`); },
  get aide() { return i18n.t(`accounting.receiptFormat.${cle}Hint`); },
});
export const FORMATS_RECU = [
  formatRecu("a4", "📄", "a4"),
  formatRecu("58", "🧾", "t58"),
  formatRecu("80", "🧾", "t80"),
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
