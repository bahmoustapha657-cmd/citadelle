import { useTranslation } from "react-i18next";
import { Btn } from "../ui";
import { compterSignalementsParSection } from "../../depart-signale";

// Bouton « 📤 Départs signalés (N) » de Comptabilité → Élèves, avec sa
// pastille : les départs que les chefs de section et la Direction ont
// signalés, dans TOUTE l'école. Absent tant qu'il n'y a rien à confirmer.
// `paquet` : celui des dispenses (use-comptabilite).
export function BoutonDepartsSignales({ paquet, onClick }) {
  const { t } = useTranslation();
  if (!paquet) return null;
  const { elevesParSection = {}, sections = [], annee = "" } = paquet;
  const ouvertes = Object.fromEntries(sections.map((s) => [s, elevesParSection[s] || []]));
  const { total } = compterSignalementsParSection(ouvertes, annee);
  if (!total) return null;
  return (
    <Btn sm v="amber" onClick={onClick} title={t("departsSignales.badge", { count: total })}>
      📤 {t("departsSignales.button")}
      <span style={{ marginInlineStart: 6, background: "#dc2626", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10.5, fontWeight: 800, lineHeight: "16px", display: "inline-block", minWidth: 16, textAlign: "center" }}>
        {total}
      </span>
    </Btn>
  );
}
