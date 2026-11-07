import i18n from "../../i18n";

// Libellés en accesseurs : ils suivent la langue choisie.
export const NIVEAUX = {
  info: { get label() { return i18n.t("sysMsg.level.info"); }, couleur: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
  important: { get label() { return i18n.t("sysMsg.level.important"); }, couleur: "#a16207", bg: "#fef3c7", border: "#fcd34d" },
  critique: { get label() { return i18n.t("sysMsg.level.critique"); }, couleur: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
};
