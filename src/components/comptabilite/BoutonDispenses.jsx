import { useTranslation } from "react-i18next";
import { Btn } from "../ui";
import { attentesParSection, totalAttentes } from "../../demande-dispense";

// Bouton « 🎓 Dispenses » des onglets Mensualités et Enrôlement. La pastille
// compte ce qui attend dans TOUTE l'école : les demandes à examiner pour la
// Direction, les refus à lire pour la comptabilité. `dispenses` : le paquet
// de use-comptabilite (élèves par section, sections ouvertes, année, rôle).
export function BoutonDispenses({ dispenses, onClick }) {
  const { t } = useTranslation();
  const { elevesParSection, sections, annee, estDirection } = dispenses;
  const total = totalAttentes(attentesParSection(elevesParSection, sections, annee, { direction: estDirection }));
  return (
    <Btn sm v="ghost" onClick={onClick}
      title={total > 0
        ? t(estDirection ? "accounting.exempt.request.badgeDirection" : "accounting.exempt.request.badgeRefused", { count: total })
        : undefined}>
      {t("accounting.mens.exemptionsBtn")}
      {total > 0 && (
        <span style={{ marginInlineStart: 6, background: "#dc2626", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10.5, fontWeight: 800, lineHeight: "16px", display: "inline-block", minWidth: 16, textAlign: "center" }}>
          {total}
        </span>
      )}
    </Btn>
  );
}
