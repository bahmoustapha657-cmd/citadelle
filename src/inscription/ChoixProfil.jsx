import { useTranslation } from "react-i18next";
import { prixEcolePublique } from "../ecole-publique";

// Premier écran de l'inscription : une école entière, une école publique
// (même parcours, offre à prix fixe proposée ensuite), ou un enseignant seul
// (espace gratuit, même si son école n'utilise pas EduGest).
const carte = {
  display: "block", width: "100%", textAlign: "start", cursor: "pointer",
  background: "#fff", border: "1.5px solid #b0c4d8", borderRadius: 12,
  padding: "14px 16px", marginTop: 12, fontFamily: "inherit",
};

export function ChoixProfil({ onChoisir }) {
  const { t } = useTranslation();
  return (
    <>
      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#0A1628", textAlign: "center" }}>
        {t("register.teacher.choiceQuestion")}
      </p>
      <button type="button" style={carte} onClick={() => onChoisir("ecole")}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>{t("register.teacher.choiceSchool")}</div>
        <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
          {t("register.teacher.choiceSchoolDesc")}
        </div>
      </button>
      {/* École publique : prix fixe quel que soit l'effectif (étape 4). */}
      <button type="button" style={carte} onClick={() => onChoisir("publique")}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>
          🏛️ {t("register.public.choice")}
          <span style={{ fontSize: 11, fontWeight: 800, color: "#047857", background: "#d1fae5", borderRadius: 6, padding: "2px 7px", marginInlineStart: 6 }}>
            {t("register.public.fixedPrice", { prix: prixEcolePublique() })}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
          {t("register.public.choiceDesc")}
        </div>
      </button>
      <button type="button" style={carte} onClick={() => onChoisir("enseignant")}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>
          {t("register.teacher.choiceTeacher")}
          <span style={{ fontSize: 11, fontWeight: 800, color: "#047857", background: "#d1fae5", borderRadius: 6, padding: "2px 7px", marginInlineStart: 6 }}>
            {t("register.teacher.free")}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
          {t("register.teacher.choiceTeacherDesc")}
        </div>
      </button>
    </>
  );
}
