import { Btn } from "../ui";
import { EdtSemaine } from "../edt-portail/EdtSemaine";
import { heuresSemaine } from "../../edt-portail";

// Emploi du temps de l'enseignant : grille de la semaine (ou une journée à la
// fois sur téléphone), une couleur par classe.
export function EdtTab({ c1, matiere, emplois, joursOuvrables, imprimerEdt }) {
  const cours = emplois.filter((c) => c.type !== "recreation");
  const classes = new Set(cours.map((c) => c.classe).filter(Boolean));
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: c1 }}>Mon emploi du temps</h2>
          {cours.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              {cours.length} cours · {heuresSemaine(emplois)} par semaine · {classes.size} classe{classes.size > 1 ? "s" : ""}
            </div>
          )}
        </div>
        {emplois.length > 0 && <Btn sm v="ghost" onClick={imprimerEdt}>🖨️ Imprimer</Btn>}
      </div>
      <EdtSemaine emplois={emplois} joursOuvrables={joursOuvrables} mode="enseignant" matiereParDefaut={matiere} c1={c1} />
    </>
  );
}
