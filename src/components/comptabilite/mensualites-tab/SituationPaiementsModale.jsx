import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modale } from "../../ui";
import { Choix } from "./ListePayesModale";
import { ListeMoisFormulaire } from "./ListeMoisFormulaire";
import { SituationGeneraleFormulaire } from "./SituationGeneraleFormulaire";

// Bouton « Situation des paiements » de l'onglet Mensualités : deux
// impressions sur le périmètre de la grille (section ou « Tout », classe) —
// la situation générale (chaque élève, chaque classe, tous les mois) ou la
// liste d'un mois (ont payé / pas encore payé).
export function SituationPaiementsModale(props) {
  const { t } = useTranslation();
  const [type, changerType] = useState("situation");
  return (
    <Modale titre={`🖨️ ${t("accounting.paySituation.title")}`} fermer={props.fermer}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
        <Choix nom="type-situation" actif={type === "situation"} onChange={() => changerType("situation")}>
          📋 {t("accounting.paySituation.typeGeneral")}
        </Choix>
        <Choix nom="type-situation" actif={type === "mois"} onChange={() => changerType("mois")}>
          📅 {t("accounting.paySituation.typeMonth")}
        </Choix>
      </div>
      {type === "situation" ? <SituationGeneraleFormulaire {...props} /> : <ListeMoisFormulaire {...props} />}
    </Modale>
  );
}
