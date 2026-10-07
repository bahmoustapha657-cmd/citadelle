import { Btn, Input, Modale, Selec, Textarea } from "../../ui";
import { notifierParents } from "../../../backend/notify-supabase";
import { absencePrete, dateAbsence } from "../../../absences-eleves";

// Modale d'enregistrement d'un événement disciplinaire (+ push parents).
export function DisciplineModale({ form, setForm, chg, eleves, ajAbs, setModal, envoyerPush }) {
  const pret = absencePrete(form);
  return (
    <Modale titre="Enregistrer un événement disciplinaire" fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}>
          {/* Choix par identifiant : l'absence porte eleveId (colonne
              obligatoire) ; le nom et la classe ne sont pas enregistrés ; le
              push ne part qu'aux parents de cet élève. */}
          <Selec label="Élève" value={form.eleveId||""} onChange={e=>{
            const el=eleves.find(ev=>ev._id===e.target.value);
            setForm(p=>({...p,eleveId:el?._id||"",eleveNom:el?`${el.nom} ${el.prenom}`:"",classe:el?.classe||""}));
          }}>
            <option value="">— Sélectionner —</option>
            {eleves.map(e=><option key={e._id} value={e._id}>{e.nom} {e.prenom}</option>)}
          </Selec>
        </div>
        <Selec label="Type" value={form.type||"Absence"} onChange={chg("type")}>
          <option>Absence</option><option>Retard</option><option>Sanction</option><option>Avertissement</option><option>Renvoi temporaire</option>
        </Selec>
        <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
        <Selec label="Justifié ?" value={form.justifie||"Non"} onChange={chg("justifie")}>
          <option>Non</option><option>Oui</option>
        </Selec>
        <div style={{gridColumn:"1/-1"}}><Textarea label="Motif / Description" value={form.motif||""} onChange={chg("motif")}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginTop:16}}>
        {!pret&&<span style={{fontSize:12,color:"#6b7280",marginInlineEnd:"auto"}}>Choisissez un élève pour enregistrer.</span>}
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn v="orange" disabled={!pret} onClick={async()=>{
          if(!pret) return;
          const abs={...form,date:dateAbsence(form)};
          await ajAbs(abs);
          setModal(null);
          if(!abs.eleveId) return;
          envoyerPush(
            ["parent"],
            `⚠️ ${abs.type||"Absence"} signalée`,
            `${abs.eleveNom||"Votre enfant"} — ${abs.type||"Absence"} du ${abs.date}${abs.motif?` : ${abs.motif}`:""}`,
            "/absences",
            { eleveId: abs.eleveId }
          );
          // Notification SMS/WhatsApp au tuteur (best-effort, inactive si non
          // configurée). Uniquement pour Absence/Retard (pas les sanctions).
          if(abs.type==="Absence"||abs.type==="Retard"){
            notifierParents("absence",{ eleveId:abs.eleveId, data:{ nomEleve:abs.eleveNom, date:abs.date } });
          }
        }}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
