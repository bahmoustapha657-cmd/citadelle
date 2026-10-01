import { C } from "../../../constants";
import { Btn } from "../../ui";
import { affNom } from "./edt-utils";
import { creneauxHorsTitulaire } from "./edt-titulaire";

const cadre = { marginBottom: 12, padding: "9px 13px", borderRadius: 8, fontSize: 12, lineHeight: 1.5 };

// Primaire et maternelle : rappelle qui tient la classe (il est attribué
// d'office aux nouveaux créneaux) et propose de lui confier les créneaux qui
// ne sont pas à son nom — sans enseignant, ou restés à l'ancien titulaire.
// Ceux d'un intervenant (anglais, EPS…) ne bougent que si l'on clique.
export function EdtTitulaireBandeau({ h, canEdit, modEmp }) {
  const { titulaire, emploisClasse, classeEdtActuelle: classe, toast } = h;

  if (!titulaire) {
    return (
      <div style={{ ...cadre, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
        ⚠️ Aucun titulaire n'est désigné pour <strong>{classe}</strong> : l'enseignant est à choisir à chaque créneau.
        Renseignez la « Classe titulaire » sur la fiche de l'enseignant (onglet Enseignants) pour qu'il soit attribué d'office.
      </div>
    );
  }

  const groupes = canEdit ? creneauxHorsTitulaire(emploisClasse, titulaire) : [];
  const confier = ({ enseignant, creneaux }) => {
    const n = creneaux.length;
    const quoi = enseignant
      ? `les ${n} créneau${n > 1 ? "x" : ""} de ${affNom(enseignant)}`
      : `les ${n} créneau${n > 1 ? "x" : ""} sans enseignant`;
    if (!window.confirm(`Confier ${quoi} à ${titulaire}, titulaire de ${classe} ?`)) return;
    creneaux.forEach((c) => modEmp({ ...c, enseignant: titulaire }));
    toast(`${n} créneau${n > 1 ? "x" : ""} confié${n > 1 ? "s" : ""} à ${titulaire}.`, "success");
  };

  return (
    <div style={{ ...cadre, background: "#f0f7ff", border: "1px solid #bfdbfe", color: C.blueDark }}>
      👩‍🏫 Titulaire de <strong>{classe}</strong> : <strong>{titulaire}</strong> — attribué d'office à chaque nouveau créneau.
      Ne choisissez un autre enseignant que pour une matière confiée à un intervenant (anglais, EPS…).
      {groupes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
          {groupes.map((g) => {
            const matieres = [...new Set(g.creneaux.map((c) => c.matiere).filter(Boolean))];
            return (
              <span key={g.enseignant || "—"} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #dbe4f0", borderRadius: 8, padding: "3px 4px 3px 10px" }}>
                <span>
                  {g.enseignant ? <strong>{affNom(g.enseignant)}</strong> : <strong>Sans enseignant</strong>}
                  {" · "}{g.creneaux.length} créneau{g.creneaux.length > 1 ? "x" : ""}
                  {matieres.length > 0 && <span style={{ color: "#64748b" }}> ({matieres.slice(0, 3).join(", ")}{matieres.length > 3 ? "…" : ""})</span>}
                </span>
                <Btn sm v="ghost" onClick={() => confier(g)}>Confier au titulaire</Btn>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
