import { useTranslation } from "react-i18next";
import { Btn } from "../ui";
import { EdtSemaine } from "../edt-portail/EdtSemaine";
import { heuresSemaine } from "../../edt-portail";
import { imprimerEdtPortail } from "../../reports";

// Emploi du temps de la classe de l'enfant courant : matière et enseignant
// dans chaque case, une couleur par matière. Lecture seule.
export function EdtTab({ emplois, joursOuvrables, eleve, eleveNom, schoolInfo, c1 }) {
  const { t } = useTranslation();
  const cours = emplois.filter((c) => c.type !== "recreation");
  const imprimer = () => imprimerEdtPortail({
    emplois, joursOuvrables, mode: "parent",
    titre: t("parent.edtTab.printTitle", { classe: eleve.classe || "" }), sousTitre: eleveNom,
    schoolInfo, annee: schoolInfo?.anneeScolaire,
  });
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: c1 }}>{t("parent.edtTab.title", { name: eleveNom })}</h2>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            {t("parent.edtTab.classLine", { classe: eleve.classe || "—" })}{cours.length > 0 && ` · ${t("parent.edtTab.coursesLine", { count: cours.length, hours: heuresSemaine(emplois) })}`}
          </div>
        </div>
        {emplois.length > 0 && <Btn sm v="ghost" onClick={imprimer}>🖨️ {t("parent.edtTab.print")}</Btn>}
      </div>
      {/* `key` : on repart du jour courant quand on change d'enfant. */}
      <EdtSemaine key={eleve._id || ""} emplois={emplois} joursOuvrables={joursOuvrables} mode="parent" c1={c1} />
    </>
  );
}
