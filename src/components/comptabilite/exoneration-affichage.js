// Libellés AFFICHÉS des dispenses, dans la langue de l'utilisateur.
// exoneration-utils garde les libellés français : ce sont eux qui partent au
// journal des actions (donnée partagée, relue par toute l'école).
import i18n from "../../i18n";
import { POSTES_EXONERABLES, clampPourcentage, getExoneration } from "../../exoneration-utils";

export const libellePoste = (poste) => i18n.t(`accounting.exempt.post.${poste}`);

export const libelleMotifAffiche = (motif) => i18n.t(`accounting.exempt.reason.${motif || "autre"}`, {
  defaultValue: i18n.t("accounting.exempt.reason.autre"),
});

// Même résumé que resumeExoneration (« Mensualités 50 % · Inscription 100 % »).
export function resumeExonerationAffiche(eleve = {}) {
  const exo = getExoneration(eleve);
  if (!exo) return "";
  return POSTES_EXONERABLES
    .filter((poste) => clampPourcentage(exo[poste]) > 0)
    .map((poste) => i18n.t("accounting.exempt.summaryItem", { label: libellePoste(poste), rate: clampPourcentage(exo[poste]) }))
    .join(" · ");
}
