import React from "react";
import { useTranslation } from "react-i18next";
import { Btn, Input, Modale, Selec } from "../../ui";
import { libelleMois, libelleSectionPaie } from "../../../i18n/libelles";
import { agentsPourBon, sectionDuBon, sectionsBonProposees } from "./bon-agents";
import { dateDuJour } from "../paiements-journal";

export function BonModale({ modal, canCreate, canEdit, form, setForm, setModal, moisModale, moisSalaire, ensCollege = [], ensLycee = [], ensPrimaire = [], ensPrescolaire = [], personnel = [], ajBon, modBon, enreg, groupesPaie }) {
  const { t } = useTranslation();
  if (!((modal==="add_b"&&canCreate)||(modal==="edit_b"&&canEdit))) return null;
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const listes = { ensCollege, ensLycee, ensPrimaire, ensPrescolaire, personnel };
  const moisBon = form.mois||moisModale;
  // Date de remise, imprimée sur la fiche du bon : le jour même à la
  // création ; un ancien bon sans date reste vide tant qu'on ne la saisit pas.
  const dateBon = form.date ?? (modal==="add_b" ? dateDuJour() : "");
  // Un bon repris de l'ancienne base n'a pas de section : on retrouve celle de
  // l'agent dans les fiches actuelles, et l'enregistrement la fixe.
  const secBon = form.section||sectionDuBon(form.nom, listes)||sectionsBonProposees(groupesPaie)[0];
  // Groupes ouverts dans l'école (+ la section du bon ouvert).
  const sections = sectionsBonProposees(groupesPaie, secBon);
  // Agents en fiche pour la section — sans attendre que la paie du mois soit
  // générée : un bon est une avance consentie en cours de mois.
  const agents = agentsPourBon(secBon, listes, form.nom);
  const libelle = secBon==="Personnel" ? t("accounting.bon.staffMember") : t("accounting.bon.teacher");
  return (
    <Modale titre={modal==="add_b"?t("accounting.bon.new"):t("accounting.bon.editTitle")} fermer={()=>setModal(null)}>
      <Selec label={t("accounting.month")} value={moisBon} onChange={chg("mois")}>
        {moisSalaire.map(m=><option key={m} value={m}>{libelleMois(m)}</option>)}
      </Selec>
      <div style={{height:10}}/>
      <Selec label={t("accounting.section")} value={secBon} onChange={e=>{chg("section")(e);setForm(p=>({...p,nom:""}));}}>
        {sections.map(s=><option key={s} value={s}>{libelleSectionPaie(s)}</option>)}
      </Selec>
      <div style={{height:10}}/>
      <Selec label={libelle} value={form.nom||""} onChange={chg("nom")}>
        <option value="">{t("enrolment.select")}</option>
        {agents.map(n=><option key={n} value={n}>{n}</option>)}
      </Selec>
      {agents.length===0&&<div style={{fontSize:11,color:"#b45309",marginTop:4}}>
        {secBon==="Personnel"
          ? t("accounting.bon.noStaff")
          : t("accounting.bon.noTeacher",{section:libelleSectionPaie(secBon)})}
      </div>}
      <div style={{height:10}}/>
      <Input label={t("accounting.bon.date")} type="date" value={dateBon} onChange={chg("date")}/>
      <div style={{height:10}}/>
      <Input label={t("accounting.bon.amount")} type="number" value={form.montant||""} onChange={chg("montant")} placeholder={t("accounting.bon.amountPh")}/>
      <div style={{height:10}}/>
      <Input label={t("accounting.bon.reason")} value={form.motif||""} onChange={chg("motif")} placeholder={t("accounting.bon.reasonPh")}/>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fce8e8",borderRadius:8,fontSize:12,color:"#9b2020"}}>
        {t("accounting.bon.deductInfo")}
        {/* i18n-ignore */}
        {secBon==="Préscolaire"&&` ${t("accounting.bon.preschoolInfo")}`}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
        <Btn onClick={()=>enreg(ajBon,modBon,{montant:Number(form.montant||0),section:secBon,mois:moisBon,date:dateBon})}>{t("common.save")}</Btn>
      </div>
    </Modale>
  );
}
