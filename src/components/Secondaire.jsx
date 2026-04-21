import React, { useState } from "react";
import { C, CLASSES_COLLEGE, CLASSES_LYCEE } from "../constants";
import { Ecole } from "./Ecole";

function Secondaire({ userRole, annee, readOnly = false, verrouOuvert = false, collegeLabel = "Bureau College" }) {
  const [sousModule, setSousModule] = useState("college");

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
        {[
          { id: "college", label: collegeLabel },
          { id: "lycee", label: "Lycee" },
        ].map((moduleItem) => (
          <button
            key={moduleItem.id}
            onClick={() => setSousModule(moduleItem.id)}
            style={{
              padding: "12px 22px",
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 13,
              background: sousModule === moduleItem.id ? C.green : "transparent",
              color: sousModule === moduleItem.id ? "#fff" : "rgba(255,255,255,0.6)",
              borderBottom: sousModule === moduleItem.id ? `3px solid ${C.green}` : "3px solid transparent",
              marginBottom: -3,
              transition: "all 0.15s",
            }}
          >
            {moduleItem.label}
          </button>
        ))}
      </div>

      {sousModule === "college" && (
        <Ecole
          titre={collegeLabel}
          couleur={C.blue}
          cleClasses="classesCollege"
          cleEns="ensCollege"
          cleNotes="notesCollege"
          cleEleves="elevesCollege"
          avecEns={true}
          userRole={userRole}
          annee={annee}
          classesPredefinies={CLASSES_COLLEGE}
          maxNote={20}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}

      {sousModule === "lycee" && (
        <Ecole
          titre="Lycee"
          couleur="#00C48C"
          cleClasses="classesLycee"
          cleEns="ensLycee"
          cleNotes="notesLycee"
          cleEleves="elevesLycee"
          avecEns={true}
          userRole={userRole}
          annee={annee}
          classesPredefinies={CLASSES_LYCEE}
          maxNote={20}
          readOnly={readOnly}
          verrouOuvert={verrouOuvert}
        />
      )}
    </div>
  );
}

export { Secondaire };
