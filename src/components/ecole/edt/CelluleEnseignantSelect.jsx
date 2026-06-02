import { Selec } from "../../ui";
import { getEligibleTeachersForTimetable } from "../../../teacher-utils";
import { getOccupiedTeachers } from "./cellule-data";

// Sélecteur d'enseignant éligible (grise ceux déjà occupés sur le créneau).
export function CelluleEnseignantSelect({ form, chg, edtCellule, classeEdtActuelle, ens, emplois, isPrimarySection }) {
  const ensOccupes = getOccupiedTeachers(emplois, edtCellule);
  const ensFiltres = getEligibleTeachersForTimetable(ens, {
    classe: form.classe || classeEdtActuelle,
    matiere: form.matiere || "",
    isPrimary: isPrimarySection,
  });
  return (
    <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
      <option value="">— Sélectionner —</option>
      {ensFiltres.map(e=>{
        const nomSimple=`${e.prenom} ${e.nom}`.trim();
        const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`;
        const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
        const label=`${nomSimple}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
        return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
      })}
    </Selec>
  );
}
