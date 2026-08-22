import React, { useContext, useState } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import {
  C, MATIERES_PRESCOLAIRE, MATIERES_PRIMAIRE,
  getClassesForSection, getSectionLabel, getSystemeScolaire, isSectionActive,
} from "../constants";
import { Ecole } from "./Ecole";

// Module « Dir. Primaire » : regroupe le PRÉSCOLAIRE (maternelle) et le
// PRIMAIRE en deux sous-onglets — même organisation que Secondaire
// (collège / lycée). Le préscolaire n'est donc PAS un module du menu : il
// relève de la direction primaire, et hérite de ses permissions.
// Une école sans maternelle ferme la section dans Paramètres → Identité :
// l'onglet disparaît (isSectionActive).
function Primaire({
  userRole, permissions = null, annee, readOnly = false, verrouOuvert = false,
}) {
  const { schoolInfo } = useContext(SchoolContext);
  const systeme = getSystemeScolaire(schoolInfo);
  // Les onglets portent le nom des SECTIONS (« Prescolaire », « Primaire »),
  // pas le libellé du poste : celui-ci nomme une fonction et peut être
  // personnalisé par l'école (ex. « Le Directeur »), ce qui donnait un
  // intitulé d'onglet incompréhensible à côté de « Prescolaire ».
  const sousModules = [
    { id: "prescolaire", label: getSectionLabel("prescolaire") },
    { id: "primaire", label: getSectionLabel("primaire") },
  ].filter((m) => isSectionActive(schoolInfo, m.id));
  // Par défaut on ouvre le primaire (le gros des effectifs) plutôt que la
  // maternelle, sauf si l'école n'a que le préscolaire d'actif.
  const defaut = sousModules.some((m) => m.id === "primaire") ? "primaire" : (sousModules[0]?.id || "primaire");
  const [sousModule, setSousModule] = useState(defaut);
  const actif = sousModules.some((m) => m.id === sousModule) ? sousModule : defaut;

  return (
    <div>
      {sousModules.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 0,
            background: C.blueDark,
            padding: "0 26px",
            borderBottom: `3px solid ${C.green}`,
          }}
        >
          {sousModules.map((moduleItem) => (
            <button
              key={moduleItem.id}
              onClick={() => setSousModule(moduleItem.id)}
              style={{
                padding: "12px 22px",
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                background: actif === moduleItem.id ? C.green : "transparent",
                color: actif === moduleItem.id ? "#fff" : "rgba(255,255,255,0.6)",
                borderBottom: actif === moduleItem.id ? `3px solid ${C.green}` : "3px solid transparent",
                marginBottom: -3,
                transition: "all 0.15s",
              }}
            >
              {moduleItem.label}
            </button>
          ))}
        </div>
      )}

      {actif === "prescolaire" && (
        <Ecole
          titre={getSectionLabel("prescolaire")}
          couleur={C.gold}
          cleClasses="classesPrescolaire"
          cleEns="ensPrescolaire"
          cleNotes="notesPrescolaire"
          cleEleves="elevesPrescolaire"
          section="prescolaire"
          avecEns={true}
          userRole={userRole}
          permissions={permissions}
          annee={annee}
          classesPredefinies={getClassesForSection("prescolaire", systeme)}
          maxNote={10}
          matieresPredefinies={MATIERES_PRESCOLAIRE}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}

      {actif === "primaire" && (
        <Ecole
          titre={getSectionLabel("primaire")}
          couleur={C.green}
          cleClasses="classesPrimaire"
          cleEns="ensPrimaire"
          cleNotes="notesPrimaire"
          cleEleves="elevesPrimaire"
          section="primaire"
          avecEns={true}
          userRole={userRole}
          permissions={permissions}
          annee={annee}
          classesPredefinies={getClassesForSection("primaire", systeme)}
          maxNote={10}
          matieresPredefinies={MATIERES_PRIMAIRE}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}
    </div>
  );
}

export { Primaire };
