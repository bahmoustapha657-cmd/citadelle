import React from "react";
import { formatDateFR, getCodeStatistique, legalProfileVide } from "../legal-utils";

// Mention légale officielle réutilisable.
// Style discret (petite police, gris), centré, n'apparaît qu'à
// l'impression et dans l'aperçu (cf. la classe `legal-footer-print`
// et les media queries `print` ci-dessous).
//
// Props :
//  - cycle: "maternelle" | "primaire" | "secondaire" — détermine le code statistique
//  - profile?: LegalProfile — profil vide par défaut : rien ne s'affiche
//    tant que l'école n'a pas renseigné son arrêté (jamais les données
//    d'une autre école)
//  - alwaysVisible?: boolean — si true, visible aussi à l'écran (utile pour la prévisualisation
//    dans le widget de conformité)
export default function OfficialLegalFooter({ cycle, profile = legalProfileVide, alwaysVisible = false }) {
  const code = getCodeStatistique(profile, cycle);
  const num = profile?.arreteOuverture?.numero;
  const date = formatDateFR(profile?.arreteOuverture?.dateSignature);
  if (!num) return null;

  const baseStyle = {
    marginTop: 14,
    paddingTop: 8,
    borderTop: "1px solid #e5e7eb",
    textAlign: "center",
    fontSize: 8.5,
    color: "#6b7280",
    lineHeight: 1.5,
    fontFamily: "Arial, sans-serif",
  };

  return (
    <div
      className={alwaysVisible ? "legal-footer" : "legal-footer-print"}
      style={baseStyle}
    >
      <style>{`
        @media screen {
          .legal-footer-print { display: none; }
        }
        @media print {
          .legal-footer-print { display: block !important; }
        }
      `}</style>
      Établissement agréé — Arrêté {num} du {date}
      {code ? ` — Code statistique : ${code}` : ""}
    </div>
  );
}
