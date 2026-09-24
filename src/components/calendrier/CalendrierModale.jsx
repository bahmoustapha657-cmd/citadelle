import { useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { getSectionLabel, getSectionsActives } from "../../constants";
import { Btn, Input, Modale, Selec, Textarea } from "../ui";
import { TYPES_EV } from "./calendrier-data";

// Modale d'ajout d'un événement au calendrier.
export function CalendrierModale({ form, chg, ajEv, setModal, toast }) {
  const { schoolInfo } = useContext(SchoolContext);
  // Niveaux proposés : les sections ouvertes dans l'école (Paramètres →
  // Identité) — pas de « Collège » dans une école primaire.
  const niveaux = ["Tous", ...getSectionsActives(schoolInfo).map(getSectionLabel)];
  return (
    <Modale titre="Nouvel événement" fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}><Input label="Titre de l'événement" value={form.titre||""} onChange={chg("titre")}/></div>
        <Selec label="Type" value={form.type||"evenement"} onChange={chg("type")}>
          {TYPES_EV.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        </Selec>
        <Selec label="Niveau concerné" value={form.niveau||"Tous"} onChange={chg("niveau")}>
          {niveaux.map((niveau) => <option key={niveau}>{niveau}</option>)}
        </Selec>
        <Input label="Date début" type="date" value={form.date||""} onChange={chg("date")}/>
        <Input label="Date fin (optionnel)" type="date" value={form.dateFin||""} onChange={chg("dateFin")}/>
        <div style={{gridColumn:"1/-1"}}><Textarea label="Description (optionnel)" value={form.description||""} onChange={chg("description")}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>{if(form.titre&&form.date){ajEv(form);setModal(null);}else toast("Titre et date requis","warning");}}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
