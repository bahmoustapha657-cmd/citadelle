import React from "react";
import { C, CLASSES_COLLEGE, CLASSES_LYCEE, fmtN } from "../../constants";
import { Badge, Btn, Card, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function EnseignantsTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  toast,
  logAction,
  ensPrimaire,
  ensCollege,
  ensLycee,
  ajEnsPrim,
  ajEnsCol,
  ajEnsLyc,
  modEnsPrim,
  modEnsCol,
  modEnsLyc,
  supEnsPrim,
  supEnsCol,
  supEnsLyc,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const ensTous=[
    ...ensPrimaire.map(e=>({...e,_section:"Primaire"})),
    ...ensCollege.map(e=>({...e,_section:"Collège"})),
    ...ensLycee.map(e=>({...e,_section:"Lycée"})),
  ];
  const ajEnsForSection=(sec)=>sec==="Primaire"?ajEnsPrim:sec==="Collège"?ajEnsCol:ajEnsLyc;
  const modEnsForSection=(sec)=>sec==="Primaire"?modEnsPrim:sec==="Collège"?modEnsCol:modEnsLyc;
  const supEnsForSection=(sec)=>sec==="Primaire"?supEnsPrim:sec==="Collège"?supEnsCol:supEnsLyc;
  const saveEns=async()=>{
    const sec=form._section||"Primaire";
    const isPrim=sec==="Primaire";
    const payload={
      nom:form.nom||"",prenom:form.prenom||"",
      telephone:form.telephone||"",
      grade:form.grade||"",
      statut:form.statut||(isPrim?"Titulaire":"Titulaire"),
    };
    if(isPrim){
      payload.montantForfait=Number(form.montantForfait||0);
      if(form.classeTitle) payload.classeTitle=form.classeTitle;
    } else {
      payload.primeHoraire=Number(form.primeHoraire||0);
      payload.primeParClasse=(form.primeParClasse||[]).filter(p=>p.classe&&Number(p.prime)>0).map(p=>({classe:p.classe,prime:Number(p.prime)}));
    }
    if(modal==="edit_ens_compta"){
      await modEnsForSection(sec)({...payload,_id:form._id});
      toast("Enseignant mis à jour.","success");
      logAction("Enseignant modifié (Compta)",`${payload.prenom} ${payload.nom} · ${sec}`);
    } else {
      await ajEnsForSection(sec)(payload);
      toast("Enseignant créé. Affectations pédagogiques à compléter dans Primaire/Secondaire.","success");
      logAction("Enseignant créé (Compta)",`${payload.prenom} ${payload.nom} · ${sec}`);
    }
    setModal(null);setForm({});
  };

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Registre des enseignants ({ensTous.length})</strong>
      {canCreate&&<Btn onClick={()=>{setForm({_section:"Primaire",statut:"Titulaire"});setModal("add_ens_compta");}}>+ Ajouter un enseignant</Btn>}
    </div>

    <div style={{padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af",marginBottom:14}}>
      <strong>Vue hybride :</strong> identité et paie modifiables ici. Les affectations pédagogiques (matière, classes titulaires, primes par classe, EDT) se gèrent dans <em>Primaire</em> ou <em>Secondaire</em>.
    </div>

    {/* Stats par section */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
      {[
        {sec:"Primaire",n:ensPrimaire.length,col:"#0ea5e9",bg:"#e0f2fe"},
        {sec:"Collège",n:ensCollege.length,col:"#7c3aed",bg:"#f3e8ff"},
        {sec:"Lycée",n:ensLycee.length,col:"#db2777",bg:"#fce7f3"},
      ].map(s=>(
        <div key={s.sec} style={{background:s.bg,borderRadius:10,padding:"12px 14px",textAlign:"center",border:`1px solid ${s.col}33`}}>
          <div style={{fontSize:11,color:s.col,fontWeight:700,marginBottom:4}}>{s.sec}</div>
          <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{s.n}</div>
        </div>
      ))}
    </div>

    {ensTous.length===0?<Vide icone="🎓" msg="Aucun enseignant enregistré"/>
      :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
        <THead cols={["Prénoms et Nom","Section","Matière","Classe titulaire","Statut","Paie",canEdit?"Actions":""]}/>
        <tbody>{ensTous.map(e=>{
          const isPrim=e._section==="Primaire";
          const paie=isPrim?"—":fmtN(e.primeHoraire||0)+" /h";
          const couleurSec=e._section==="Primaire"?"bleu":e._section==="Collège"?"violet":"rose";
          return <TR key={`${e._section}-${e._id}`}>
            <TD bold>{e.prenom||""} {e.nom||""}</TD>
            <TD><Badge color={couleurSec}>{e._section}</Badge></TD>
            <TD>{e.matiere||"—"}</TD>
            <TD>{e.classeTitle||"—"}</TD>
            <TD><Badge color={(e.statut||"Titulaire")==="Titulaire"?"vert":"gray"}>{e.statut||"Titulaire"}</Badge></TD>
            <TD center>{paie}</TD>
            {canEdit&&<TD center>
              <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens_compta");}}>✏️ Paie</Btn>
              <Btn sm v="red" onClick={()=>confirm(`Supprimer ${e.prenom} ${e.nom} ?`)&&supEnsForSection(e._section)(e._id)}>🗑</Btn>
            </TD>}
          </TR>;
        })}</tbody>
      </table></Card>
    }

    {/* MODAL création / édition paie */}
    {(modal==="add_ens_compta"&&canCreate||(modal==="edit_ens_compta"&&canEdit))&&(()=>{
      const isEdit=modal==="edit_ens_compta";
      const isPrim=(form._section||"Primaire")==="Primaire";
      return <Modale large titre={isEdit?"Modifier la paie":"Nouvel enseignant"} fermer={()=>{setModal(null);setForm({});}}>
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
          const classesDispo=sec==="Lycée"?CLASSES_LYCEE:CLASSES_COLLEGE;
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
      </Modale>;
    })()}
  </div>;
}
