import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { exportExcel } from "../../reports";
import { getEvaluationLabel } from "../../evaluation-forms";
import { NotesGrille } from "./notes-tab/NotesGrille";
import { NotesListe } from "./notes-tab/NotesListe";
import { ImportNotesModal } from "./notes-tab/ImportNotesModal";
import { AjoutNoteModal } from "./notes-tab/AjoutNoteModal";

// Onglet Notes : barre d'outils + vue (liste/grille) + modales import/saisie.
// Les blocs sont dans notes-tab/.
export function NotesTab({
  annee,
  periodes = ["T1", "T2", "T3"],
  notes,
  cN,
  ajN,
  supN,
  eleves,
  matieres,
  matieresForClasse,
  noteForms,
  defaultNoteType,
  schoolInfo,
  isPrimarySection,
  avecEns,
  maxNote,
  readOnly,
  canCreate,
  canEdit,
  form,
  setForm,
  modal,
  setModal,
  notesVue,
  setNotesVue,
  grilleClasse,
  setGrilleClasse,
  grillePeriode,
  setGrillePeriode,
  grilleType,
  setGrilleType,
  grilleChanges,
  setGrilleChanges,
  grilleSaving,
  setGrilleSaving,
  importPreview,
  setImportPreview,
  importEnCours,
  setImportEnCours,
  toast,
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, color: C.blueDark, flex: 1 }}>{t("school.tabs.notes")} ({notes.length})</strong>
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
          {[{ v: "liste", icon: "☰" }, { v: "grille", icon: "⊞" }].map(({ v, icon }) => (
            <button key={v} onClick={() => setNotesVue(v)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: notesVue === v ? "#fff" : "transparent", color: notesVue === v ? C.blueDark : "#94a3b8",
              boxShadow: notesVue === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>{icon}</button>
          ))}
        </div>
        <Btn sm v="ghost" onClick={() => exportExcel(
          `${t("reports.excel.files.notes")}_${avecEns ? "College" : "Primaire"}`,
          [t("reports.excel.headers.student"), t("reports.excel.headers.subject"), t("reports.excel.headers.type"), t("reports.excel.headers.period"), `${t("reports.excel.headers.grade")} /${maxNote}`],
          notes.map(n => [n.eleveNom, n.matiere, getEvaluationLabel(n.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" }), n.periode, n.note])
        )}>📥 {t("common.export")}</Btn>
        <Btn sm v="ghost" onClick={() => exportExcel(t("reports.excel.files.notesTemplate"),
          [t("reports.excel.headers.studentFullName"), t("reports.excel.headers.subject"), t("reports.excel.headers.type"), t("reports.excel.headers.period"), `${t("reports.excel.headers.grade")} (/${maxNote})`],
          eleves.slice(0, 3).map(e => [`${e.nom} ${e.prenom}`, matieres[0]?.nom || "Maths", noteForms[0]?.label || "Devoir", periodes[0] || "T1", Math.round(maxNote * 0.7)])
        )}>📋 {t("common.template")}</Btn>
        {canCreate && <Btn sm v="vert" onClick={() => setModal("import_notes")}>⬆️ {t("common.import")}</Btn>}
        {canCreate && <Btn onClick={() => { setForm({ periode: periodes[0] || "T1", type: defaultNoteType }); setModal("add_n"); }}>+ {t("common.add")}</Btn>}
      </div>

      {notesVue === "grille" && (
        <NotesGrille
          eleves={eleves}
          notes={notes}
          matieresForClasse={matieresForClasse}
          noteForms={noteForms}
          periodes={periodes}
          maxNote={maxNote}
          annee={annee}
          canCreate={canCreate}
          ajN={ajN}
          toast={toast}
          grilleClasse={grilleClasse} setGrilleClasse={setGrilleClasse}
          grillePeriode={grillePeriode} setGrillePeriode={setGrillePeriode}
          grilleType={grilleType} setGrilleType={setGrilleType}
          grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
          grilleSaving={grilleSaving} setGrilleSaving={setGrilleSaving}
        />
      )}

      {notesVue === "liste" && (
        <NotesListe
          cN={cN}
          notes={notes}
          maxNote={maxNote}
          readOnly={readOnly}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          canEdit={canEdit}
          supN={supN}
        />
      )}

      {modal === "import_notes" && canCreate && (
        <ImportNotesModal
          setModal={setModal}
          importPreview={importPreview} setImportPreview={setImportPreview}
          importEnCours={importEnCours} setImportEnCours={setImportEnCours}
          noteForms={noteForms}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          periodes={periodes}
          maxNote={maxNote}
          eleves={eleves}
          ajN={ajN}
          annee={annee}
          toast={toast}
        />
      )}

      {modal === "add_n" && canCreate && (
        <AjoutNoteModal
          form={form} setForm={setForm} setModal={setModal}
          eleves={eleves}
          matieresForClasse={matieresForClasse}
          noteForms={noteForms}
          defaultNoteType={defaultNoteType}
          maxNote={maxNote}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          periodes={periodes}
          annee={annee}
          ajN={ajN}
        />
      )}
    </div>
  );
}
