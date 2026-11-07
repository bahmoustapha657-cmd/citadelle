import { Selec } from "../../ui";

// Classe de titulaire d'un enseignant : choisie dans la liste des classes
// EXISTANTES, plus jamais tapée à la main. La saisie libre créait une classe
// fantôme à la moindre faute de frappe (« 3eme Année A » ≠ « 3ème Année A »),
// et l'enseignant ne voyait alors aucun élève.
//  - `classes` : noms des classes de la section (onglet Classes) ;
//  - `ens` / `ensId` : pour signaler une classe déjà tenue par un collègue.
// Une ancienne valeur absente de la liste reste affichée (et signalée) pour
// ne pas l'effacer en silence à l'enregistrement.
export function ClasseTitulaireSelect({ value = "", onChange, classes = [], ens = [], ensId = null, label = "Classe titulaire" }) {
  const noms = [...new Set(classes.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  const tenuePar = (classe) => {
    const e = ens.find((item) => item.classeTitle === classe && item._id !== ensId);
    return e ? `${e.prenom || ""} ${e.nom || ""}`.trim() : "";
  };
  const inconnue = value && !noms.includes(value);
  return (
    <>
      <Selec label={label} value={value} onChange={onChange}>
        <option value="">— Aucune (non titulaire) —</option>
        {noms.map((nom) => {
          const autre = tenuePar(nom);
          return <option key={nom} value={nom}>{nom}{autre ? ` — déjà : ${autre}` : ""}</option>;
        })}
        {inconnue && <option value={value}>{value} (classe introuvable)</option>}
      </Selec>
      {noms.length === 0 && (
        <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
          Aucune classe dans cette section : créez-la d'abord dans l'onglet Classes.
        </div>
      )}
      {inconnue && (
        <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>
          « {value} » n'existe pas dans les classes : choisissez la bonne classe.
        </div>
      )}
    </>
  );
}
