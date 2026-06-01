import { Vide, Chargement } from "../ui";
import { useEdtTab } from "./edt/use-edt-tab";
import { EdtToolbar } from "./edt/EdtToolbar";
import { EdtGrille } from "./edt/EdtGrille";
import { EdtListe } from "./edt/EdtListe";
import { CelluleModale } from "./edt/CelluleModale";
import { EdtGeneralModale } from "./edt/EdtGeneralModale";

// Onglet emploi du temps : consomme useEdtTab puis aiguille vers la barre
// d'outils, la vue grille ou liste, et les modales (cellule + EDT général).
export function EmploiDuTempsTab({
  maxNote,
  canCreate,
  canEdit,
  isPrimarySection,
  form,
  setForm,
  chg,
  filtreClasse,
  setFiltreClasse,
  classes,
  matieres,
  ens,
  emplois,
  cEmp,
  ajEmp,
  modEmp,
  supEmp,
}) {
  const h = useEdtTab({ maxNote, classes, matieres, ens, emplois, filtreClasse, ajEmp, supEmp });

  return <div>
    <EdtToolbar h={h} maxNote={maxNote} canCreate={canCreate} setFiltreClasse={setFiltreClasse} setEdtDuree={h.setEdtDuree} edtDuree={h.edtDuree} />

    {classes.length === 0
      ? <Vide icone="📅" msg="Créez d'abord des classes" />
      : cEmp ? <Chargement />
      : h.edtVueGrille
        ? <EdtGrille h={h} emplois={emplois} canCreate={canCreate} canEdit={canEdit} setForm={setForm} />
        : <EdtListe h={h} canEdit={canEdit} setForm={setForm} supEmp={supEmp} />}

    <CelluleModale
      edtCellule={h.edtCellule} setEdtCellule={h.setEdtCellule} canCreate={canCreate} canEdit={canEdit}
      form={form} setForm={setForm} chg={chg}
      classeEdtActuelle={h.classeEdtActuelle} matieres={matieres} ens={ens} emplois={emplois} isPrimarySection={isPrimarySection}
      ajEmp={ajEmp} modEmp={modEmp} supEmp={supEmp} toast={h.toast}
    />

    <EdtGeneralModale
      edtGeneralOuvert={h.edtGeneralOuvert} setEdtGeneralOuvert={h.setEdtGeneralOuvert}
      classes={classes} classesTriees={h.classesTriees} emplois={emplois}
      TRANCHES={h.TRANCHES} nbTranches={h.nbTranches}
      matCouleur={h.matCouleur} findEns={h.findEns} schoolInfo={h.schoolInfo}
    />
  </div>;
}
