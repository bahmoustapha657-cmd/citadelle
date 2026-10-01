import { Selec } from "../../ui";
import { getEligibleTeachersForTimetable } from "../../../teacher-utils";
import { getOccupiedTeachers } from "./cellule-data";
import { memeEnseignant, nomEnseignant } from "./edt-titulaire";

// Sélecteur d'enseignant éligible (grise ceux déjà occupés sur le créneau).
// Primaire et maternelle (`parTitulaire`) : le titulaire de la classe en tête,
// quelle que soit la matière — il les enseigne toutes —, puis les autres
// enseignants de la matière pour un cours confié à un intervenant.
export function CelluleEnseignantSelect({ form, chg, edtCellule, classeEdtActuelle, ens, emplois, isPrimarySection, parTitulaire = false, titulaire = "" }) {
  const ensOccupes = getOccupiedTeachers(emplois, edtCellule);
  const option = (e, suffixe = "") => {
    const nomSimple=`${e.prenom} ${e.nom}`.trim();
    const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`;
    const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
    const label=`${nomSimple}${suffixe}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
    return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
  };

  if (!parTitulaire) {
    const ensFiltres = getEligibleTeachersForTimetable(ens, {
      classe: form.classe || classeEdtActuelle,
      matiere: form.matiere || "",
      isPrimary: isPrimarySection,
    });
    return (
      <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
        <option value="">— Sélectionner —</option>
        {ensFiltres.map(e=>option(e))}
      </Selec>
    );
  }

  const ficheTitulaire = titulaire ? ens.find(e=>memeEnseignant(nomEnseignant(e), titulaire)) : null;
  const autres = getEligibleTeachersForTimetable(ens, { matiere: form.matiere || "" })
    .filter(e=>e!==ficheTitulaire);
  // Créneau déjà tenu par quelqu'un qui n'est plus proposé (ancien
  // titulaire, fiche renommée…) : on le garde visible plutôt que d'afficher
  // « — Sélectionner — » sur un créneau pourtant attribué.
  // Valeur recalée sur l'option correspondante (casse, accents, ancien
  // suffixe « (Matière) »), sinon le sélecteur paraîtrait vide.
  const actuel = form.enseignant || "";
  const ficheActuelle = actuel
    ? [ficheTitulaire, ...autres].find(e=>e && memeEnseignant(nomEnseignant(e), actuel))
    : null;
  const valeur = ficheActuelle ? `${ficheActuelle.prenom} ${ficheActuelle.nom}`.trim()
    : titulaire && memeEnseignant(actuel, titulaire) ? titulaire : actuel;
  const actuelAbsent = actuel && !ficheActuelle && !memeEnseignant(actuel, titulaire);
  return (
    <Selec label="Enseignant" value={valeur} onChange={chg("enseignant")}>
      <option value="">— Sélectionner —</option>
      {titulaire && <optgroup label="Titulaire de la classe">
        {ficheTitulaire ? option(ficheTitulaire, " — titulaire") : <option value={titulaire}>{titulaire} — titulaire</option>}
      </optgroup>}
      {autres.length > 0 && <optgroup label={titulaire ? "Autre enseignant (intervenant)" : "Enseignants"}>
        {autres.map(e=>option(e))}
      </optgroup>}
      {actuelAbsent && <option value={actuel}>{actuel}</option>}
    </Selec>
  );
}
