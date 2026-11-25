import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtN, getMonnaie } from "../../../constants";
import { moisGarantieEcole } from "../../../paiements-scolarite";
import { imprimerSituationGenerale } from "../../../reports";
import { Btn } from "../../ui";
import { reglagesAlerte } from "./alerte-mensualites";
import { Choix } from "./ListePayesModale";
import { grouperSituation, lignesSituation, totalSituation } from "./situation-generale";

const titreBloc = { fontSize: 13, fontWeight: 700, margin: "14px 0 6px" };

// « Situation des paiements » → « Situation générale » : élève par élève
// (une case par mois, total payé) ou les classes seules ; tous les élèves,
// ceux en retard ou ceux à jour ; une page par classe ou non — avec un
// aperçu. Élèves : le périmètre de la grille, déjà filtré.
export function SituationGeneraleFormulaire({ eleves, moisAnnee = [], annee, tarifsClasses, schoolInfo, perimetre, fermer }) {
  const { t } = useTranslation();
  const [detail, changerDetail] = useState("eleves");
  const [filtre, changerFiltre] = useState("tous");
  const [pageParClasse, setPageParClasse] = useState(false);
  const classesSeules = detail === "classes";
  const monnaie = schoolInfo?.monnaie || getMonnaie();
  // Retard = mêmes règles que l'alerte mensualités (échéance, mois de garantie).
  const { jourEcheance } = reglagesAlerte(schoolInfo);
  const moisGarantie = moisGarantieEcole(schoolInfo);
  // Le tableau des classes compte tous les élèves : à jour ET en retard.
  const filtreApplique = classesSeules ? "tous" : filtre;
  const lignes = useMemo(
    () => lignesSituation(eleves, { filtre: filtreApplique, moisAnnee, annee, tarifsClasses, jourEcheance, moisGarantie }),
    [eleves, filtreApplique, moisAnnee, annee, tarifsClasses, jourEcheance, moisGarantie],
  );
  const groupes = useMemo(() => grouperSituation(lignes), [lignes]);
  const total = totalSituation(groupes);

  return (
    <>
      <div style={{ ...titreBloc, marginTop: 0 }}>{t("accounting.paySituation.detail")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Choix nom="detail-situation" actif={!classesSeules} onChange={() => changerDetail("eleves")}>
          👤 {t("accounting.paySituation.detailStudents")}
        </Choix>
        <Choix nom="detail-situation" actif={classesSeules} onChange={() => changerDetail("classes")}>
          🏫 {t("accounting.paySituation.detailClasses")}
        </Choix>
      </div>

      {!classesSeules && <>
        <div style={titreBloc}>{t("accounting.paySituation.filter")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["tous", t("accounting.paySituation.filterAll")],
            ["retard", `⏳ ${t("accounting.paySituation.filterLate")}`],
            ["ajour", `✅ ${t("accounting.paySituation.filterUpToDate")}`],
          ].map(([id, label]) => (
            <Choix key={id} nom="filtre-situation" actif={filtre === id} onChange={() => changerFiltre(id)}>{label}</Choix>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={pageParClasse} onChange={(e) => setPageParClasse(e.target.checked)} />
          {t("accounting.monthList.pagePerClass")}
        </label>
      </>}

      <div style={{ fontSize: 12, color: "#334155", margin: "14px 0 4px", fontWeight: 700 }}>
        {t("accounting.paySituation.summary", {
          n: total.effectif, classes: groupes.length, upToDate: total.aJour, late: total.enRetard,
          amount: fmtN(total.total), currency: monnaie,
        })}
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>{t("accounting.paySituation.note")}</div>
      <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 12, lineHeight: 1.6 }}>
        {classesSeules
          ? groupes.slice(0, 5).map((g) => (
            <li key={g.classe || "-"}>
              <strong>{g.classe || "—"}</strong> · {t("accounting.paySituation.classLine", {
                n: g.effectif, upToDate: g.aJour, late: g.enRetard,
              })} · {fmtN(g.total)} {monnaie}
            </li>
          ))
          : lignes.slice(0, 5).map((l) => (
            <li key={l.eleve._id}>
              <strong>{l.eleve.nom} {l.eleve.prenom}</strong> · {l.eleve.classe} · {t("accounting.paySituation.monthsPaid", {
                n: l.moisPayes,
              })}{l.enRetard && <span style={{ color: "#b91c1c" }}> · {t("accounting.paySituation.late", { n: l.moisRetard })}</span>}
              {" "}· {fmtN(l.total)} {monnaie}
            </li>
          ))}
        {(classesSeules ? groupes.length : lignes.length) > 5 && <li style={{ listStyle: "none", color: "#64748b" }}>…</li>}
      </ol>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn disabled={!lignes.length} onClick={() => {
          imprimerSituationGenerale(groupes, {
            moisAnnee, detail, filtre: filtreApplique, pageParClasse: !classesSeules && pageParClasse, schoolInfo, annee, perimetre,
          });
          fermer();
        }}>🖨️ {t("common.print")}</Btn>
      </div>
    </>
  );
}
