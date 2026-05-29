import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { Badge, Tabs, LectureSeule } from "./ui";
import { LivretsTab } from "./LivretsTab";
import { EmploiDuTempsTab } from "./ecole/EmploiDuTempsTab";
import { AttestationsTab } from "./ecole/AttestationsTab";
import { ClassesTab } from "./ecole/ClassesTab";
import { EnseignementsTab } from "./ecole/EnseignementsTab";
import { DisciplineTab } from "./ecole/DisciplineTab";
import { BulletinsTab } from "./ecole/BulletinsTab";
import { MatieresTab } from "./ecole/MatieresTab";
import { ApercuTab } from "./ecole/ApercuTab";
import { EnsTab } from "./ecole/EnsTab";
import { ElevesTab } from "./ecole/ElevesTab";
import { NotesTab } from "./ecole/NotesTab";
import { useEcole } from "./ecole/use-ecole";

// Orchestrateur du module École : la logique vit dans useEcole,
// chaque onglet dans ecole/*Tab.jsx.
function Ecole({ titre, couleur, cleClasses, cleEns, cleNotes, cleEleves, avecEns, userRole, annee, classesPredefinies, maxNote = 20, matieresPredefinies = [], readOnly = false, verrouOuvert = false }) {
  const { t } = useTranslation();
  const e = useEcole({ cleClasses, cleEns, cleNotes, cleEleves, userRole, annee, readOnly, verrouOuvert });

  const tabItems = [
    { id: "apercu", label: t("school.tabs.overview") },
    { id: "classes", label: `${t("school.tabs.classes")} (${e.classes.length})` },
    { id: "eleves", label: `${t("school.tabs.students")} (${e.eleves.length})` },
    ...(avecEns ? [{ id: "ens", label: `${t("school.tabs.teachers")} (${e.ens.length})` }] : []),
    { id: "notes", label: `${t("school.tabs.notes")} (${e.notes.length})` },
    { id: "enseignements", label: t("school.tabs.teachings") },
    { id: "discipline", label: t("school.tabs.discipline") },
    { id: "bulletins", label: t("school.tabs.bulletins") },
    { id: "livrets", label: "📋 Livrets" },
    { id: "matieres", label: t("school.tabs.subjects") },
    ...(avecEns ? [{ id: "emploidutemps", label: t("school.tabs.schedule") }] : []),
    { id: "attestations", label: t("school.tabs.certificates") },
  ];

  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {e.schoolInfo?.logo && <img src={e.schoolInfo.logo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>{titre}</h2>
          <p style={{ margin: 0, fontSize: 12, color: couleur, fontWeight: 700 }}>{t("school.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("common.yearViewed")} :</label>
          <select value={e.anneeConsultee} onChange={(ev) => e.setAnneeConsultee(ev.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${e.enModeArchive ? "#f59e0b" : "#cbd5e1"}`, fontSize: 13, fontWeight: 700,
              background: e.enModeArchive ? "#fef3c7" : "#fff", color: e.enModeArchive ? "#92400e" : C.blueDark, cursor: "pointer" }}>
            {e.anneesDispo.map((a) => <option key={a} value={a}>{a}{a === e.anneeCourante ? ` (${t("common.current")})` : ""}</option>)}
          </select>
          {e.enModeArchive && <Badge color="orange">📚 {t("common.archive")} — {t("common.readOnly")}</Badge>}
        </div>
      </div>
      {readOnly && <LectureSeule />}
      <div style={{ background: "#fef3e0", border: "1px solid #fbbf24", borderRadius: 8, padding: "9px 14px", fontSize: 12, color: "#92400e", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span>{t("school.enrollmentNotice")}</span>
      </div>
      <Tabs items={tabItems} actif={e.tab} onChange={e.setTab} />

      {/* ── APERÇU ── */}
      {e.tab === "apercu" && <ApercuTab
        classes={e.classes}
        eleves={e.eleves}
        ens={e.ens}
        notes={e.notes}
        absences={e.absences}
        avecEns={avecEns}
        moy={e.moy}
        maxNote={maxNote}
        cC={e.cC}
        cE={e.cE}
        classesUniq={e.classesUniq}
        effectifReel={e.effectifReel}
        matieresForClasse={e.matieresForClasse}
        couleur={couleur}
        schoolInfo={e.schoolInfo}
      />}

      {/* ── CLASSES ── */}
      {e.tab === "classes" && <ClassesTab
        classes={e.classes}
        eleves={e.eleves}
        ens={e.ens}
        cC={e.cC}
        ajC={e.ajC}
        modC={e.modC}
        supC={e.supC}
        schoolInfo={e.schoolInfo}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        classesPredefinies={classesPredefinies}
        effectifReel={e.effectifReel}
        saveClasse={e.saveClasse}
        toast={e.toast}
      />}

      {/* ── ÉLÈVES (lecture seule — enrôlement dans Comptabilité) ── */}
      {e.tab === "eleves" && <ElevesTab
        eleves={e.eleves}
        elevesFiltres={e.elevesFiltres}
        cE={e.cE}
        cleEleves={cleEleves}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        avecEns={avecEns}
        annee={annee}
        schoolInfo={e.schoolInfo}
        schoolId={e.schoolId}
        toast={e.toast}
        logAction={e.logAction}
        canEdit={e.canEdit}
        canCreateParent={e.canCreateParent}
        parentEleve={e.parentEleve}
        setParentEleve={e.setParentEleve}
        formP={e.formP}
        setFormP={e.setFormP}
      />}

      {/* ── ENSEIGNANTS ── */}
      {e.tab === "ens" && avecEns && <EnsTab
        ens={e.ens}
        cEns={e.cEns}
        supEns={e.supEns}
        cleEns={cleEns}
        isPrimarySection={e.isPrimarySection}
        couleur={couleur}
        schoolId={e.schoolId}
        toast={e.toast}
        logAction={e.logAction}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        ensCompte={e.ensCompte}
        setEnsCompte={e.setEnsCompte}
        formC={e.formC}
        setFormC={e.setFormC}
        saveEnseignant={e.saveEnseignant}
      />}

      {/* ── NOTES ── */}
      {e.tab === "notes" && <NotesTab
        annee={annee}
        periodes={e.periodes}
        notes={e.notes}
        cN={e.cN}
        ajN={e.ajN}
        supN={e.supN}
        eleves={e.eleves}
        matieres={e.matieres}
        matieresForClasse={e.matieresForClasse}
        noteForms={e.noteForms}
        defaultNoteType={e.defaultNoteType}
        schoolInfo={e.schoolInfo}
        isPrimarySection={e.isPrimarySection}
        avecEns={avecEns}
        maxNote={maxNote}
        readOnly={readOnly}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        notesVue={e.notesVue}
        setNotesVue={e.setNotesVue}
        grilleClasse={e.grilleClasse}
        setGrilleClasse={e.setGrilleClasse}
        grillePeriode={e.grillePeriode}
        setGrillePeriode={e.setGrillePeriode}
        grilleType={e.grilleType}
        setGrilleType={e.setGrilleType}
        grilleChanges={e.grilleChanges}
        setGrilleChanges={e.setGrilleChanges}
        grilleSaving={e.grilleSaving}
        setGrilleSaving={e.setGrilleSaving}
        importPreview={e.importPreview}
        setImportPreview={e.setImportPreview}
        importEnCours={e.importEnCours}
        setImportEnCours={e.setImportEnCours}
        toast={e.toast}
      />}

      {/* ── ENSEIGNEMENTS ── */}
      {e.tab === "enseignements" && <EnseignementsTab
        enseignements={e.enseignements}
        cEng={e.cEng}
        ajEng={e.ajEng}
        modEng={e.modEng}
        supEng={e.supEng}
        classes={e.classes}
        ens={e.ens}
        matieres={e.matieres}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
      />}

      {/* ── DISCIPLINE ── */}
      {e.tab === "discipline" && <DisciplineTab
        absences={e.absences}
        cAbs={e.cAbs}
        ajAbs={e.ajAbs}
        supAbs={e.supAbs}
        eleves={e.eleves}
        avecEns={avecEns}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        envoyerPush={e.envoyerPush}
      />}

      {/* ── BULLETINS ── */}
      {e.tab === "bulletins" && <BulletinsTab
        periodes={e.periodes}
        rechercheMatricule={e.rechercheMatricule}
        setRechercheMatricule={e.setRechercheMatricule}
        periodeB={e.periodeB}
        setPeriodeB={e.setPeriodeB}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        elevesFiltres={e.elevesFiltres}
        eleves={e.eleves}
        notes={e.notes}
        matieres={e.matieres}
        matieresForClasse={e.matieresForClasse}
        schoolInfo={e.schoolInfo}
        moisAnnee={e.moisAnnee}
        maxNote={maxNote}
        avecEns={avecEns}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        getAppreciation={e.getAppreciation}
        saveAppreciation={e.saveAppreciation}
        appreciationsParEleveB={e.appreciationsParEleveB}
      />}

      {/* ── LIVRETS ── */}
      {e.tab === "livrets" && <LivretsTab
        periodes={e.periodes}
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={e.matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {e.tab === "matieres" && <MatieresTab
        matieres={e.matieres}
        cMat={e.cMat}
        ajMat={e.ajMat}
        modMat={e.modMat}
        supMat={e.supMat}
        classes={e.classes}
        matieresPredefinies={matieresPredefinies}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
      />}

      {e.tab === "emploidutemps" && avecEns && <EmploiDuTempsTab
        maxNote={maxNote}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        isPrimarySection={e.isPrimarySection}
        form={e.form}
        setForm={e.setForm}
        chg={e.chg}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classes={e.classes}
        matieres={e.matieres}
        ens={e.ens}
        emplois={e.emplois}
        cEmp={e.cEmp}
        ajEmp={e.ajEmp}
        modEmp={e.modEmp}
        supEmp={e.supEmp}
      />}

      {/* ── ATTESTATIONS DE NIVEAU ── */}
      {e.tab === "attestations" && <AttestationsTab
        rechercheMatricule={e.rechercheMatricule}
        setRechercheMatricule={e.setRechercheMatricule}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        elevesFiltres={e.elevesFiltres}
        schoolInfo={e.schoolInfo}
        annee={annee}
        avecEns={avecEns}
        cE={e.cE}
      />}
    </div>
  );
}

export { Ecole };
