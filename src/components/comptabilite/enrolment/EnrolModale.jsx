import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { STATUTS_SORTIE, sectionOuverte } from "../../../constants";
import { libelleSection } from "../../../i18n/libelles";
import { Btn, Modale, Selec } from "../../ui";
import { EnrolFormChamps } from "./EnrolFormChamps";
import { PhotoEleveChamp } from "./PhotoEleveChamp";
import { useEnrolPhoto } from "./use-enrol-photo";
import { RetourChoix } from "./RetourChoix";
import { aujourdhuiIso } from "../../../depart-utils";
import { changerSectionFormulaire, matriculeSaisieRapide, sectionsSaisieRapide } from "./rapide-enrol";

export function EnrolModale({
  modal, setModal, form, setForm, chg, niveauEnrol, schoolInfo, elevesParNiveau = {},
  schoolId, toast, tousElevesScolarite, ajoutParNiveau, modChampParNiveau, rechargerParNiveau, ensureClasse,
}) {
  // Section de la fiche, choisie comme dans la saisie rapide. Celle d'origine
  // est la liste d'où la fiche a été ouverte — pas `form.niveau`, une copie
  // enregistrée qui peut dater d'avant une promotion.
  const { t } = useTranslation();
  const sectionOrigine = sectionOuverte(schoolInfo, niveauEnrol);
  const [classeOrigine] = useState(form.classe || "");
  const [sectionChoisie, setSectionChoisie] = useState(
    modal === "add_enrol" ? sectionOuverte(schoolInfo, form.niveau || niveauEnrol) : sectionOrigine,
  );
  const sections = sectionsSaisieRapide(schoolInfo);
  const section = sections.includes(sectionChoisie) ? sectionChoisie : sectionOrigine;
  const deplacement = modal === "edit_enrol" && section !== sectionOrigine;

  // Retour d'un élève parti par sa fiche (statut repassé à « Actif ») : même
  // question qu'avec ↩ Réintégrer — les mois d'absence sont-ils dus ?
  const [statutOrigine] = useState(form.statut || "");
  const [departOrigine] = useState(form.dateDepart || "");
  const [dateRetour, setDateRetour] = useState(aujourdhuiIso);
  const [absenceDue, setAbsenceDue] = useState(null);
  const enRetour = modal === "edit_enrol" && STATUTS_SORTIE.includes(statutOrigine) && !STATUTS_SORTIE.includes(form.statut);
  const retour = enRetour ? { dateDepart: departOrigine, dateRetour, absenceDue } : null;

  // Changer de section vide la classe (propre à chaque cycle). Un nouvel
  // élève reçoit le matricule de sa section ; un élève existant garde le sien.
  const changerSection = (e) => {
    const s = e.target.value;
    setSectionChoisie(s);
    setForm((p) => (modal === "add_enrol"
      ? changerSectionFormulaire(p, s, matriculeSaisieRapide(s, { elevesParNiveau, schoolInfo }))
      : { ...p, classe: s === sectionOrigine ? classeOrigine : "" }));
  };

  const { uploadEnCours, enregistrer } = useEnrolPhoto({
    modal, setModal, form, section, sectionOrigine, classeOrigine, retour,
    schoolId, toast, tousElevesScolarite, ajoutParNiveau, modChampParNiveau, rechargerParNiveau, ensureClasse,
  });

  return (<Modale large titre={modal==="add_enrol"?t("accounting.enrol.newTitle"):t("accounting.enrol.editTitle")} fermer={()=>setModal(null)}>
    {sections.length>1&&<div style={{marginBottom:12,maxWidth:260}}>
      <Selec label={t("accounting.enrol.sectionField")} value={section} onChange={changerSection}>
        {sections.map(s=><option key={s} value={s}>{libelleSection(s)}</option>)}
      </Selec>
    </div>}
    {deplacement&&<div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#92400e"}}>
      🌉 <Trans i18nKey="accounting.enrol.moveNotice" values={{ from: libelleSection(sectionOrigine), to: libelleSection(section) }} components={{ b: <strong /> }} />
    </div>}
    <EnrolFormChamps form={form} chg={chg} niveauEnrol={section}/>
    {enRetour&&<div style={{marginTop:14,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"12px 14px"}}>
      <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:"#166534"}}>↩ {t("accounting.enrol.returnTitle")}</p>
      <RetourChoix dateDepart={departOrigine} dateRetour={dateRetour} setDateRetour={setDateRetour}
        absenceDue={absenceDue} setAbsenceDue={setAbsenceDue}/>
    </div>}
    <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:14}}>
      <PhotoEleveChamp photo={form.photo} retouche={form.photoRetouche} toast={toast}
        onChange={(photo,photoRetouche)=>setForm(p=>({...p,photo,photoRetouche}))}/>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={uploadEnCours}>{t("common.cancel")}</Btn>
      <Btn disabled={uploadEnCours} onClick={enregistrer}>{uploadEnCours?`⏳ ${t("accounting.collect.saving")}`:t("common.save")}</Btn>
    </div>
  </Modale>);
}
