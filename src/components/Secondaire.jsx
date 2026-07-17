import React, { useContext, useState } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { C, getClassesForSection, getSystemeScolaire, isSectionActive } from "../constants";
import { Ecole } from "./Ecole";

function Secondaire({ userRole, permissions = null, annee, readOnly = false, verrouOuvert = false, collegeLabel = "Bureau College" }) {
  const { schoolInfo } = useContext(SchoolContext);
  const systeme = getSystemeScolaire(schoolInfo);
  // Sections déclarées dans Paramètres → Identité : une école sans lycée
  // n'affiche que le collège (et inversement).
  const sousModules = [
    { id: "college", label: collegeLabel },
    { id: "lycee", label: "Lycee" },
  ].filter((m) => isSectionActive(schoolInfo, m.id));
  const [sousModule, setSousModule] = useState(sousModules[0]?.id || "college");
  // Si la section sélectionnée vient d'être fermée dans Paramètres, on
  // retombe sur la première section encore ouverte.
  const actif = sousModules.some((m) => m.id === sousModule) ? sousModule : (sousModules[0]?.id || "college");

  return (
    <div>
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

      {actif === "college" && (
        <Ecole
          titre={collegeLabel}
          couleur={C.blue}
          cleClasses="classesCollege"
          cleEns="ensCollege"
          cleNotes="notesCollege"
          cleEleves="elevesCollege"
          avecEns={true}
          userRole={userRole}
          permissions={permissions}
          annee={annee}
          classesPredefinies={getClassesForSection("college", systeme)}
          maxNote={20}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}

      {actif === "lycee" && (
        <Ecole
          titre="Lycee"
          couleur="#00C48C"
          cleClasses="classesLycee"
          cleEns="ensLycee"
          cleNotes="notesLycee"
          cleEleves="elevesLycee"
          avecEns={true}
          userRole={userRole}
          permissions={permissions}
          annee={annee}
          classesPredefinies={getClassesForSection("lycee", systeme)}
          maxNote={20}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}
    </div>
  );
}

export { Secondaire };
