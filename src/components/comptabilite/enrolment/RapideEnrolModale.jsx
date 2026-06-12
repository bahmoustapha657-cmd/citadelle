import React from "react";
import { C, initMens, genererMatricule, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Btn, Champ, Input, Modale, Selec } from "../../ui";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";

export function RapideEnrolModale({
  setModal, form, setForm, chg, niveauEnrol,
  schoolInfo, toast, tousElevesScolarite, ajEnrol, ensureClasse, elevesEnrol,
}) {
  const sauvegarderRapide = async (fermer) => {
    if(!form.nom||!form.prenom){toast("Nom et prénom obligatoires","warning");return false;}
    if(!form.classe){toast("Classe obligatoire","warning");return false;}
    const r={...form,statut:"Actif",mens:initMens()};
    const doublon = findEnrollmentDuplicate(r, tousElevesScolarite);
    if(doublon){
      toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
      return false;
    }
    await ajEnrol(r);
    await ensureClasse(r.classe, niveauEnrol);
    toast(`${r.prenom} ${r.nom} ajoute(e)`,"success");
    if(!fermer){
      const mat=genererMatricule([...elevesEnrol,r],niveauEnrol,schoolInfo);
      setForm(p=>({tuteur:p.tuteur,contactTuteur:p.contactTuteur,filiation:p.filiation,domicile:p.domicile,
        statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"}));
    }
    return true;
  };

  return (<Modale titre="⚡ Saisie rapide — Fratrie / même tuteur" fermer={()=>setModal(null)}>
    <div style={{background:"#f0f6ff",border:`1.5px solid ${C.blue}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        👨‍👩‍👧‍👦 Informations communes (conservées pour chaque élève)
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")} placeholder="Bah Mamadou"/>
        <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")} placeholder="622 000 000"/>
        <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")} placeholder="Père: … / Mère: …"/></div>
        <div style={{gridColumn:"1/-1"}}><Input label="Domicile" value={form.domicile||""} onChange={chg("domicile")} placeholder="Quartier, commune…"/></div>
      </div>
    </div>
    <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px"}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>
        🎓 Élève à inscrire
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Nom *" value={form.nom||""} onChange={chg("nom")} placeholder="Bah"/>
        <Input label="Prénom *" value={form.prenom||""} onChange={chg("prenom")} placeholder="Aminata"/>
        <Champ label="Classe *">
          <select value={form.classe||""} onChange={chg("classe")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
            <option value="">— Sélectionner —</option>
        {getClassesForSection(niveauEnrol, getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
          </select>
        </Champ>
        <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
          <option value="M">Masculin</option><option value="F">Féminin</option>
        </Selec>
        <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
        <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
          <option>Première inscription</option><option>Réinscription</option>
        </Selec>
        <Champ label="Matricule (auto)">
          <input value={form.matricule||""} onChange={chg("matricule")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
        </Champ>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
      <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
      <Btn v="ghost" onClick={async()=>{ await sauvegarderRapide(false); }}>➕ Élève suivant</Btn>
      <Btn onClick={async()=>{ if(await sauvegarderRapide(true)) setModal(null); }}>✅ Terminer</Btn>
    </div>
  </Modale>);
}
