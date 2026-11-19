import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Chargement } from "../ui";
import { FicheNotesVue } from "./dgecs-tab/FicheNotesVue";
import { StatistiquesVue } from "./dgecs-tab/StatistiquesVue";
import { CandidatsVue } from "./dgecs-tab/CandidatsVue";

// Onglet « DGECS » du module École (lot B, 2026-11-19) : ce que la plateforme
// du ministère (dgecsecoles.com) demande, prêt à recopier. Calculs :
// src/dgecs.js ; impressions : src/reports/dgecs-print.js.
const VUES = ["notes", "stats", "candidates"];

export function DgecsTab(props) {
  const { t } = useTranslation();
  const [vue, setVue] = useState("notes");
  if (props.chargement) return <Chargement />;
  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--lc-text-muted)", margin: "0 0 12px" }}>{t("dgecs.intro")}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {VUES.map((v) => (
          <Btn key={v} sm v={vue === v ? "blue" : "ghost"} onClick={() => setVue(v)}>{t(`dgecs.views.${v}`)}</Btn>
        ))}
      </div>
      {vue === "notes" && <FicheNotesVue {...props} />}
      {vue === "stats" && <StatistiquesVue {...props} />}
      {vue === "candidates" && <CandidatsVue {...props} />}
    </div>
  );
}
