import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn } from "../../ui";
import { estSorti } from "../../../constants";
import { matriculeDgecs } from "../../../dgecs";
import { sansComptabilite } from "../../../ecole-publique";
import { ImportDgecsModale } from "../../dgecs-import/ImportDgecsModale";

// Vue « Depuis DGECS » de l'onglet DGECS : où en sont les matricules de la
// section, et la fenêtre qui recopie la liste de la plateforme. Une école
// avec comptabilité inscrit ses nouveaux élèves à l'enrôlement (paiement
// d'inscription) : ici, elle pose seulement les matricules.
export function ImportVue({
  eleves = [], classes = [], classesUniq = [], section, schoolInfo, canEdit, modChampE, ajE, toast, logAction, filtreClasse,
}) {
  const { t } = useTranslation();
  const [ouverte, setOuverte] = useState(false);
  const presents = useMemo(() => eleves.filter((e) => !estSorti(e)), [eleves]);
  const avecMatricule = presents.filter((e) => matriculeDgecs(e)).length;
  const nomsClasses = useMemo(() => [...new Set([...classes.map((c) => c?.nom).filter(Boolean), ...classesUniq])]
    .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true })), [classes, classesUniq]);
  const peutInscrire = sansComptabilite(schoolInfo) && canEdit && !!ajE;
  const peutRattacher = canEdit && !!modChampE;

  return (
    <div style={{ background: "var(--lc-surface)", border: "1px solid var(--lc-border)", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--lc-text)", lineHeight: 1.6 }}>{t("dgecs.import.intro")}</p>
      <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: avecMatricule < presents.length ? "#b45309" : "#166534" }}>
        {t("dgecs.import.coverage", { done: avecMatricule, total: presents.length })}
      </p>
      {!peutInscrire && peutRattacher && <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--lc-text-muted)" }}>{t("dgecs.import.enrolInAccounting")}</p>}
      {peutRattacher
        ? <Btn v="vert" onClick={() => setOuverte(true)}>🇬🇳 {t("dgecs.import.button")}</Btn>
        : <p style={{ fontSize: 12, color: "var(--lc-text-muted)" }}>{t("dgecs.import.readOnly")}</p>}
      {ouverte && (
        <ImportDgecsModale
          section={section} schoolInfo={schoolInfo} toast={toast} logAction={logAction}
          classes={nomsClasses} classeInitiale={filtreClasse && filtreClasse !== "all" ? filtreClasse : ""}
          eleves={presents} tous={eleves} elevesSection={eleves}
          ajouter={peutInscrire ? ajE : null} modifierChamp={modChampE}
          fermer={() => setOuverte(false)}
        />
      )}
    </div>
  );
}
