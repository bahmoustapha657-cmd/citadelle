import { useTranslation } from "react-i18next";
import { Btn } from "../ui";
import { EdtSemaine } from "../edt-portail/EdtSemaine";
import { heuresSemaine } from "../../edt-portail";

// Emploi du temps de l'enseignant : grille de la semaine (ou une journée à la
// fois sur téléphone), une couleur par classe.
export function EdtTab({ c1, matiere, emplois, joursOuvrables, imprimerEdt }) {
  const { t } = useTranslation();
  const cours = emplois.filter((c) => c.type !== "recreation");
  const classes = new Set(cours.map((c) => c.classe).filter(Boolean));
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: c1 }}>{t("teacher.edt.title")}</h2>
          {cours.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              {t("teacher.edt.summary", { count: cours.length, hours: heuresSemaine(emplois) })} · {t(classes.size > 1 ? "teacher.edt.classMany" : "teacher.edt.classOne", { count: classes.size })}
            </div>
          )}
        </div>
        {emplois.length > 0 && <Btn sm v="ghost" onClick={imprimerEdt}>🖨️ {t("teacher.edt.print")}</Btn>}
      </div>
      <EdtSemaine emplois={emplois} joursOuvrables={joursOuvrables} mode="enseignant" matiereParDefaut={matiere} c1={c1} />
    </>
  );
}
