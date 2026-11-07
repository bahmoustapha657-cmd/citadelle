import { useTranslation } from "react-i18next";
import { lireDate } from "../../../depart-utils";
import { localeCourante } from "../../../i18n";
import { Input } from "../../ui";

// Retour d'un élève parti : la direction choisit, à CHAQUE retour, si les
// mois passés hors de l'école sont dus (cf. champsRetour). Aucun choix n'est
// présélectionné : c'est une décision d'argent, elle doit être prise.
// `absenceDue` : true | false | null (pas encore choisi).
export function RetourChoix({ dateDepart, dateRetour, setDateRetour, absenceDue, setAbsenceDue }) {
  const { t } = useTranslation();
  const option = (valeur, titre, detail) => (
    <label style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 10px",borderRadius:8,cursor:"pointer",
      border:`1.5px solid ${absenceDue === valeur ? "#2563eb" : "var(--lc-border)"}`,
      background:absenceDue === valeur ? "#eff6ff" : "transparent"}}>
      <input type="radio" name="absenceDue" checked={absenceDue === valeur} onChange={() => setAbsenceDue(valeur)} style={{marginTop:2}}/>
      <span style={{fontSize:12}}>
        <strong>{titre}</strong>
        <span style={{display:"block",color:"#6b7280",marginTop:2}}>{detail}</span>
      </span>
    </label>
  );
  return (
    <div style={{display:"grid",gap:10}}>
      <div style={{maxWidth:220}}>
        <Input label={t("accounting.enrol.returnDate")} type="date" value={dateRetour || ""} onChange={(e) => setDateRetour(e.target.value)}/>
      </div>
      {lireDate(dateDepart) && <p style={{margin:0,fontSize:12,color:"#6b7280"}}>
        {t("accounting.enrol.leftOn", { date: lireDate(dateDepart).toLocaleDateString(localeCourante()) })}
      </p>}
      {option(false, t("accounting.enrol.absenceNotDue"), t("accounting.enrol.absenceNotDueHint"))}
      {option(true, t("accounting.enrol.absenceDue"), t("accounting.enrol.absenceDueHint"))}
    </div>
  );
}
