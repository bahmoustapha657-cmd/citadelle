import { today } from "../../../constants";
import { Btn, Input, Modale, Selec, Textarea } from "../../ui";

// Modale d'ajout / modification d'un enseignement.
export function EnseignementsModale({ form, chg, modal, setModal, ens, matieres, classes, ajEng, modEng }) {
  return (
    <Modale titre={modal==="add_eng"?"Enregistrer un enseignement":"Modifier"} fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}>
          <Selec label="Enseignant" value={form.enseignantNom||""} onChange={chg("enseignantNom")}>
            <option value="">— Sélectionner —</option>
            {ens.map(e=><option key={e._id}>{e.prenom} {e.nom}</option>)}
          </Selec>
        </div>
        <Selec label="Matière" value={form.matiere||""} onChange={chg("matiere")}>
          <option value="">—</option>
          {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
        </Selec>
        <Selec label="Classe" value={form.classe||""} onChange={chg("classe")}>
          <option value="">—</option>
          {classes.map(c=><option key={c._id}>{c.nom}</option>)}
        </Selec>
        <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
        <Input label="Heure" type="time" value={form.heure||""} onChange={chg("heure")}/>
        <Selec label="Type" value={form.type||"Cours"} onChange={chg("type")}>
          <option>Cours</option>
          <option>Composition</option>
          <option>Devoir surveillé</option>
          <option>Correction</option>
        </Selec>
        <Selec label="Statut" value={form.statut||"Effectué"} onChange={chg("statut")}>
          <option>Effectué</option>
          <option>Absent</option>
          <option>Retard</option>
          <option>Non effectué</option>
        </Selec>
        <div style={{gridColumn:"1/-1"}}><Textarea label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={()=>{
          const r={...form,date:form.date||today()};
          if(modal==="add_eng")ajEng(r);else modEng(r);
          setModal(null);
        }}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
