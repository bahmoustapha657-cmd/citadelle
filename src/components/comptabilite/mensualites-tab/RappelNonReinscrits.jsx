import { useTranslation } from "react-i18next";
import { Btn } from "../../ui";
import { imprimerListeNonReinscrits } from "../../../reports";
import { dateRetraitEcole, estNonReinscritSansPaiement, formaterDateRetrait } from "../../../ecartes-non-reinscrits";
import { elevesNonReinscrits } from "./alerte-mensualites";

// Rappel au comptable, en tête de l'onglet Mensualités : les non réinscrits
// (aucun paiement de l'année) retirés des classes, à faire réinscrire — ou,
// avant la date du retrait, ceux qui partiront ce jour-là.
// `eleves` : élèves du périmètre affiché (section, classe), AVANT retrait.
// `retires` : ceux que la règle retire (ecarterNonReinscrits).
// `regle` : celle de regleEcartement ; `voirRetires` / `basculer` : la grille
// montre les retirés à la place de la classe (encaissement de la réinscription).
export function RappelNonReinscrits({
  eleves, retires, regle, schoolInfo, annee, moisAnnee, tarifsClasses, perimetre, voirRetires, basculer, estArchive,
}) {
  const { t, i18n } = useTranslation();
  if (estArchive) return null;
  const dateRetrait = dateRetraitEcole(schoolInfo, annee);
  const date = formaterDateRetrait(dateRetrait, i18n.language);
  const imprimer = (liste) => imprimerListeNonReinscrits(elevesNonReinscrits(liste, { moisAnnee, tarifsClasses }), {
    schoolInfo, annee, perimetre, moisAnnee, retires: true, dateRetrait: date,
  });
  const boutonListe = (liste) => (
    <Btn sm v="ghost" disabled={!liste.length} onClick={() => imprimer(liste)}>{t("accounting.nonReinscrits.listeAppeler")}</Btn>
  );

  // Avant la date : préavis, sans rien retirer.
  if (!regle.toutes) {
    const partants = dateRetrait && dateRetrait > new Date() ? eleves.filter(estNonReinscritSansPaiement) : [];
    if (!partants.length) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14,
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 14px" }}>
        <span style={{ fontSize: 16 }}>⏳</span>
        <span style={{ fontSize: 12.5, color: "#92400e", flex: 1, minWidth: 220 }}>
          <strong>{t("accounting.nonReinscrits.avantNombre", { n: partants.length })}</strong>{" "}
          {t("accounting.nonReinscrits.avantSuite", { perimetre, date })}
        </span>
        {boutonListe(partants)}
      </div>
    );
  }

  if (!retires.length && !voirRetires) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14,
      background: voirRetires ? "#eff6ff" : "#fff7ed", border: `1px solid ${voirRetires ? "#bfdbfe" : "#fdba74"}`,
      borderRadius: 10, padding: "10px 14px" }}>
      <span style={{ fontSize: 18 }}>📝</span>
      <span style={{ fontSize: 12.5, color: voirRetires ? "#1e3a8a" : "#9a3412", flex: 1, minWidth: 240, lineHeight: 1.5 }}>
        {voirRetires ? (
          <>
            <strong>{t("accounting.nonReinscrits.retiresTitre", { n: retires.length })}</strong>{" "}
            {t("accounting.nonReinscrits.retiresAide")}
          </>
        ) : (
          <>
            <strong>{t("accounting.nonReinscrits.nombre", { n: retires.length })}</strong>{" "}
            {t("accounting.nonReinscrits.explication", { perimetre, date })}{" "}
            <strong>{t("accounting.nonReinscrits.appel")}</strong>
          </>
        )}
      </span>
      {boutonListe(retires)}
      <Btn sm v={voirRetires ? "ghost" : undefined} onClick={basculer}>
        {voirRetires ? t("accounting.nonReinscrits.revenir") : t("accounting.nonReinscrits.afficher")}
      </Btn>
    </div>
  );
}
