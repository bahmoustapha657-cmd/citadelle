import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtN, getMonnaie } from "../../../constants";
import { imprimerListeMois } from "../../../reports";
import { Btn } from "../../ui";
import { Choix } from "./ListePayesModale";
import { grouperParClasse, lignesListeMois, moisParDefaut, totauxListeMois } from "./liste-mois";

// « Situation des paiements » → « Un mois » : le mois, ceux qui l'ont payé ou
// pas encore, une page par classe ou non — avec un aperçu. Élèves : le
// périmètre de la grille (section ou « Tout », classe), déjà filtré.
export function ListeMoisFormulaire({ eleves, moisAnnee = [], annee, tarifsClasses, schoolInfo, perimetre, fermer }) {
  const { t } = useTranslation();
  const [mois, setMois] = useState(() => moisParDefaut(moisAnnee));
  const [statut, changerStatut] = useState("payes");
  const [pageParClasse, setPageParClasse] = useState(false);
  const monnaie = schoolInfo?.monnaie || getMonnaie();
  const lignes = useMemo(
    () => lignesListeMois(eleves, { mois, statut, moisAnnee, annee, tarifsClasses }),
    [eleves, mois, statut, moisAnnee, annee, tarifsClasses],
  );
  const groupes = useMemo(() => grouperParClasse(lignes), [lignes]);
  const totaux = totauxListeMois(lignes);
  const nomMois = t(`months.${mois}`, mois);

  return (
    <>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("accounting.monthList.month")}</label>
      <select value={mois} onChange={(e) => setMois(e.target.value)}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13, width: "100%" }}>
        {moisAnnee.map((m) => <option key={m} value={m}>{t(`months.${m}`, m)}</option>)}
      </select>

      <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>{t("accounting.monthList.who")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Choix nom="statut-liste-mois" actif={statut === "payes"} onChange={() => changerStatut("payes")}>
          ✅ {t("accounting.monthList.paid", { month: nomMois })}
        </Choix>
        <Choix nom="statut-liste-mois" actif={statut === "impayes"} onChange={() => changerStatut("impayes")}>
          ⏳ {t("accounting.monthList.unpaid", { month: nomMois })}
        </Choix>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={pageParClasse} onChange={(e) => setPageParClasse(e.target.checked)} />
        {t("accounting.monthList.pagePerClass")}
      </label>

      <div style={{ fontSize: 12, color: "#334155", margin: "14px 0 4px", fontWeight: 700 }}>
        {t(statut === "impayes" ? "accounting.monthList.summaryUnpaid" : "accounting.monthList.summaryPaid", {
          n: lignes.length, classes: groupes.length, amount: fmtN(totaux.montantMois), currency: monnaie, month: nomMois,
        })}
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>{t("accounting.monthList.totalNote")}</div>
      <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 12, lineHeight: 1.6 }}>
        {lignes.slice(0, 5).map(({ eleve: e, total }) => (
          <li key={e._id}><strong>{e.nom} {e.prenom}</strong> · {e.classe} · {fmtN(total)} {monnaie}</li>
        ))}
        {lignes.length > 5 && <li style={{ listStyle: "none", color: "#64748b" }}>…</li>}
      </ol>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn disabled={!lignes.length} onClick={() => {
          imprimerListeMois(groupes, { mois, statut, pageParClasse, schoolInfo, annee, perimetre });
          fermer();
        }}>🖨️ {t("common.print")}</Btn>
      </div>
    </>
  );
}
