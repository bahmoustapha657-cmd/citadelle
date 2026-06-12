import { useContext } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { C, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Btn, Input, Modale, Selec } from "../../ui";

// Modale de création / édition de la paie d'un enseignant (forfait primaire
// ou prime horaire + primes par classe pour le secondaire).
export function EnseignantModale({ form, setForm, modal, setModal, canCreate, canEdit, chg, saveEns }) {
  const { schoolInfo } = useContext(SchoolContext);
  if (!((modal === "add_ens_compta" && canCreate) || (modal === "edit_ens_compta" && canEdit))) return null;
  const isEdit = modal === "edit_ens_compta";
  const isPrim = (form._section || "Primaire") === "Primaire";
  return (
    <Modale large titre={isEdit?"Modifier la paie":"Nouvel enseignant"} fermer={()=>{setModal(null);setForm({});}}>
      {!isEdit&&<div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:6}}>Section</div>
        <div style={{display:"flex",gap:8}}>
          {["Primaire","Collège","Lycée"].map(s=>(
            <button key={s} type="button" onClick={()=>setForm(p=>({...p,_section:s}))}
              style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${form._section===s?C.blue:"#e2e8f0"}`,background:form._section===s?C.blue:"#fff",color:form._section===s?"#fff":"#475569",cursor:"pointer",fontWeight:700,fontSize:13}}>
              {s}
            </button>
          ))}
        </div>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Nom" value={form.nom||""} onChange={chg("nom")} disabled={isEdit}/>
        <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")} disabled={isEdit}/>
        <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
        <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
        <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
          <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
        </Selec>
        {isPrim?<>
          <Input label="Forfait mensuel (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")} placeholder="Ex : 1500000"/>
          <div style={{gridColumn:"1/-1"}}>
            <Input label="Classe titulaire (optionnel)" value={form.classeTitle||""} onChange={chg("classeTitle")} placeholder="Ex : 3ème Année A"/>
          </div>
        </>:<>
          <Input label="Prime horaire (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")} placeholder="Ex : 15000"/>
        </>}
      </div>
      {!isPrim&&(()=>{
        const sec=form._section||"Collège";
        const classesDispo=getClassesForSection(sec==="Lycée"?"lycee":"college", getSystemeScolaire(schoolInfo));
        return <div style={{marginTop:14,borderTop:"1px solid #e2e8f0",paddingTop:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:8}}>
            Primes par classe <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>(si la prime varie selon la classe enseignée — sinon laissez vide)</span>
          </div>
          {(form.primeParClasse||[]).map((entry,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
              <select value={entry.classe||""}
                onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],classe:e.target.value};return{...p,primeParClasse:arr};})}
                style={{flex:2,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12,background:"#fff"}}>
                <option value="">— Choisir une classe —</option>
                {classesDispo.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={entry.prime||""} placeholder="Prime GNF"
                onChange={e=>setForm(p=>{const arr=[...(p.primeParClasse||[])];arr[i]={...arr[i],prime:Number(e.target.value)};return{...p,primeParClasse:arr};})}
                style={{flex:1,border:"1px solid #b0c4d8",borderRadius:6,padding:"5px 8px",fontSize:12}}/>
              <Btn sm v="danger" onClick={()=>setForm(p=>({...p,primeParClasse:(p.primeParClasse||[]).filter((_,j)=>j!==i)}))}>×</Btn>
            </div>
          ))}
          <Btn sm v="ghost" onClick={()=>setForm(p=>({...p,primeParClasse:[...(p.primeParClasse||[]),{classe:"",prime:0}]}))}>+ Ajouter une classe</Btn>
          <div style={{fontSize:11,color:"#64748b",marginTop:6,fontStyle:"italic"}}>
            💡 Choisissez parmi les classes officielles — un libellé exact garantit que la prime soit prise en compte lors du calcul du salaire.
          </div>
        </div>;
      })()}
      <div style={{marginTop:12,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#854d0e"}}>
        {isPrim
          ? "Le forfait sera repris automatiquement lors de la génération mensuelle des salaires."
          : "Lors de la génération des salaires : la prime utilisée pour chaque classe enseignée est celle saisie ci-dessus si renseignée, sinon la prime horaire unique. Le total = somme(prime classe × heures EDT de cette classe) × 4 semaines."
        }
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>{setModal(null);setForm({});}}>Annuler</Btn>
        <Btn onClick={saveEns}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
