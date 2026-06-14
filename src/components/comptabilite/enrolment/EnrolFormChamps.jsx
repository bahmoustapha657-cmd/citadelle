import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { C, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Champ, Input, Selec } from "../../ui";

// Grille de champs du formulaire d'inscription d'un élève.
// Les `value` des options (statut, type d'inscription, sexe) restent en
// français : ce sont les valeurs STOCKÉES et comparées ailleurs dans le
// code — seul l'affichage est traduit via t().
export function EnrolFormChamps({ form, chg, niveauEnrol }) {
  const { schoolInfo } = useContext(SchoolContext);
  const { t } = useTranslation();
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
      <Input label={t("enrolment.lastName")} value={form.nom||""} onChange={chg("nom")}/>
      <Input label={t("enrolment.firstName")} value={form.prenom||""} onChange={chg("prenom")}/>
      <Champ label={t("enrolment.matricule")}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input value={form.matricule||""} onChange={chg("matricule")}
            style={{flex:1,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
          <span style={{fontSize:10,color:"#9ca3af",whiteSpace:"nowrap"}}>{t("enrolment.matriculeEditable")}</span>
        </div>
      </Champ>
      <Champ label={t("enrolment.ien")}>
        <div style={{position:"relative"}}>
          <input value={form.ien||""} onChange={chg("ien")}
            placeholder={t("enrolment.ienPlaceholder")}
            style={{width:"100%",border:"1.5px solid #c7d2fe",borderRadius:8,padding:"7px 10px 7px 30px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#eef2ff",fontFamily:"monospace",fontWeight:700,color:"#3730a3"}}/>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🪪</span>
        </div>
      </Champ>
      <Champ label={t("enrolment.class")}>
        <select value={form.classe||""} onChange={chg("classe")}
          style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
          <option value="">{t("enrolment.select")}</option>
          {getClassesForSection(niveauEnrol, getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
        </select>
      </Champ>
      <Selec label={t("enrolment.sex")} value={form.sexe||"M"} onChange={chg("sexe")}>
        <option value="M">{t("enrolment.male")}</option><option value="F">{t("enrolment.female")}</option>
      </Selec>
      <Selec label={t("enrolment.status")} value={form.statut||"Actif"} onChange={chg("statut")}>
        <option value="Actif">{t("enrolment.statusActive")}</option>
        <option value="Inactif">{t("enrolment.statusInactive")}</option>
        <option value="Transféré">{t("enrolment.statusTransferred")}</option>
        <option value="Exclu">{t("enrolment.statusExpelled")}</option>
        <option value="Abandonné">{t("enrolment.statusDroppedOut")}</option>
        <option value="Décédé">{t("enrolment.statusDeceased")}</option>
      </Selec>
      <Selec label={t("enrolment.enrollmentType")} value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
        <option value="Première inscription">{t("enrolment.firstEnrollment")}</option>
        <option value="Réinscription">{t("enrolment.reEnrollment")}</option>
      </Selec>
      {["Transféré","Exclu","Abandonné","Décédé"].includes(form.statut)&&<>
        <Input label={t("enrolment.departureDate")} type="date" value={form.dateDepart||""} onChange={chg("dateDepart")}/>
        <div style={{gridColumn:"1/-1"}}>
          <Input label={t("enrolment.departureReason")} value={form.motifDepart||""} onChange={chg("motifDepart")} placeholder={t("enrolment.departureReasonPlaceholder")}/>
        </div>
        {form.statut==="Transféré"&&<div style={{gridColumn:"1/-1"}}>
          <Input label={t("enrolment.destinationSchool")} value={form.destinationDepart||""} onChange={chg("destinationDepart")} placeholder={t("enrolment.destinationSchoolPlaceholder")}/>
        </div>}
      </>}
      <div style={{gridColumn:"1/-1"}}><Input label={t("enrolment.parentage")} value={form.filiation||""} onChange={chg("filiation")}/></div>
      <Input label={t("enrolment.guardianName")} value={form.tuteur||""} onChange={chg("tuteur")}/>
      <Input label={t("enrolment.guardianContact")} value={form.contactTuteur||""} onChange={chg("contactTuteur")}/>
      <Input label={t("enrolment.guardianAddress")} value={form.domicile||""} onChange={chg("domicile")}/>
      <Input label={t("enrolment.dateOfBirth")} type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
      <Input label={t("enrolment.placeOfBirth")} value={form.lieuNaissance||""} onChange={chg("lieuNaissance")}/>
      {form.typeInscription==="Réinscription"&&
        <Input label={t("enrolment.previousSchool")} value={form.etablissementOrigine||""} onChange={chg("etablissementOrigine")} placeholder={t("enrolment.previousSchoolPlaceholder")}/>
      }
    </div>
  );
}
