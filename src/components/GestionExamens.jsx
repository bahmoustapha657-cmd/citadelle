import { useTranslation } from "react-i18next";
import { Btn, Vide } from "./ui";
import { useExamens } from "./examens/use-examens";
import { ExamenCard } from "./examens/ExamenCard";
import { ExamensPasses } from "./examens/ExamensPasses";
import { ExamenModale } from "./examens/ExamenModale";

// Gestion des examens : consomme useExamens et aiguille vers l'en-tête/filtre,
// les cartes à venir, le tableau des passés et la modale de planification.
function GestionExamens() {
  const { t } = useTranslation();
  const x = useExamens();
  return (
    <div style={{ padding: "22px 26px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: x.c1 }}>📝 {t("nav.exams")}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{x.examens.length} examen(s) planifié(s)</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={x.filtre} onChange={e => x.setFiltre(e.target.value)}
            style={{ border: "1px solid #b0c4d8", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
            <option value="all">{t("common.all")}</option>
            <option value="Toutes">Toutes (globaux)</option>
            {x.classes.map(c => <option key={c}>{c}</option>)}
          </select>
          <Btn onClick={() => { x.setForm({ type: x.defaultExamType, classe: "Toutes" }); x.setModal("add"); }}>+ Planifier</Btn>
        </div>
      </div>

      {x.aVenir.length > 0 && <>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: x.c1, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>À venir ({x.aVenir.length})</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12, marginBottom: 20 }}>
          {x.aVenir.map(ex => (
            <ExamenCard key={ex._id} ex={ex} schoolInfo={x.schoolInfo} c1={x.c1} c2={x.c2}
              genererConvocations={x.genererConvocations} setForm={x.setForm} setModal={x.setModal} supEx={x.supEx} />
          ))}
        </div>
      </>}

      {x.passes.length > 0 && <ExamensPasses passes={x.passes} schoolInfo={x.schoolInfo} genererConvocations={x.genererConvocations} supEx={x.supEx} />}

      {x.examens.length === 0 && <Vide icone="📝" msg="Aucun examen planifié" />}

      {(x.modal === "add" || x.modal === "edit") &&
        <ExamenModale modal={x.modal} setModal={x.setModal} form={x.form} chg={x.chg}
          examForms={x.examForms} defaultExamType={x.defaultExamType} classes={x.classes} saveExam={x.saveExam} />}
    </div>
  );
}

export { GestionExamens };
