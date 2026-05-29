import React from "react";
import { Btn, Modale, Input, Selec } from "../../ui";
import { C } from "../../../constants";
import { getEligibleTeachersForTimetable } from "../../../teacher-utils";

export function CelluleModale({
  edtCellule, setEdtCellule, canCreate, canEdit,
  form, setForm, chg,
  classeEdtActuelle, matieres, ens, emplois, isPrimarySection,
  ajEmp, modEmp, supEmp, toast,
}) {
  if (!edtCellule || !(canCreate || canEdit)) return null;
  return (
    <Modale titre={edtCellule.existing ? "Modifier le créneau" : "Nouveau créneau"} fermer={() => setEdtCellule(null)}>
      <div style={{marginBottom:12,padding:"8px 12px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark,display:"flex",gap:16,flexWrap:"wrap"}}>
        <span>📅 <strong>{edtCellule.jour}</strong></span>
        <span>⏰ <strong>{edtCellule.heureDebut} → {edtCellule.heureFin}</strong></span>
        <span>🏫 <strong>{form.classe||classeEdtActuelle}</strong></span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{v:"cours",label:"📚 Cours"},{v:"revision",label:"📝 Révision"}].map(t=>(
          <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
            style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
              background:(form.type||"cours")===t.v?(t.v==="revision"?"#fff7ed":"#eff6ff"):"#f9fafb",
              border:`2px solid ${(form.type||"cours")===t.v?(t.v==="revision"?"#f97316":"#3b82f6"):"#e5e7eb"}`,
              color:(form.type||"cours")===t.v?(t.v==="revision"?"#9a3412":"#1d4ed8"):"#6b7280"}}>
            {t.label}
          </button>
        ))}
      </div>

      {(form.type||"cours")==="revision"&&(
        <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>📝</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:"#9a3412",marginBottom:4}}>Prime horaire révision</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" value={form.primeRevision||""}
                onChange={e=>setForm(p=>({...p,primeRevision:e.target.value}))}
                placeholder="Ex : 50000"
                style={{border:"1px solid #fdba74",borderRadius:6,padding:"6px 10px",fontSize:13,width:140,background:"#fff"}}/>
              <span style={{fontSize:12,color:"#c2410c",fontWeight:600}}>GNF / heure</span>
            </div>
            <div style={{fontSize:11,color:"#c2410c",marginTop:4}}>Cette prime remplace la prime horaire normale pour ce créneau.</div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Selec label="Matière" value={form.matiere||""} onChange={e=>{setForm(p=>({...p,matiere:e.target.value,enseignant:""}));}}>
          <option value="">— Sélectionner —</option>
          {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
        </Selec>
        {(()=>{
          const ensOccupes=emplois
            .filter(x=>x.jour===edtCellule.jour&&x.heureDebut===edtCellule.heureDebut
              &&(!edtCellule.existing||x._id!==edtCellule.existing._id)&&x.enseignant)
            .map(x=>x.enseignant);
          const ensFiltres=getEligibleTeachersForTimetable(ens,{
            classe: form.classe||classeEdtActuelle,
            matiere: form.matiere||"",
            isPrimary: isPrimarySection,
          });
          return <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
            <option value="">— Sélectionner —</option>
            {ensFiltres.map(e=>{
              const nomSimple=`${e.prenom} ${e.nom}`.trim();
              const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`;
              const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
              const label=`${nomSimple}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
              return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
            })}
          </Selec>;
        })()}
        <Input label="Salle (optionnel)" value={form.salle||""} onChange={chg("salle")}/>
        <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
          <Input label="Début" type="time" value={form.heureDebut||edtCellule.heureDebut} onChange={chg("heureDebut")}/>
          <Input label="Fin" type="time" value={form.heureFin||edtCellule.heureFin} onChange={chg("heureFin")}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
        <div>
          {edtCellule.existing&&canEdit&&<Btn v="danger" onClick={()=>{supEmp(edtCellule.existing._id);setEdtCellule(null);}}>🗑 Supprimer</Btn>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setEdtCellule(null)}>Annuler</Btn>
          <Btn onClick={()=>{
            if(!form.matiere){toast("Choisissez une matière.","warning");return;}
            if(!form.enseignant){toast("Choisissez un enseignant.","warning");return;}
            const typeCreneaux=form.type||"cours";
            const data={
              classe:form.classe||classeEdtActuelle,
              jour:edtCellule.jour,
              heureDebut:form.heureDebut||edtCellule.heureDebut,
              heureFin:form.heureFin||edtCellule.heureFin,
              matiere:form.matiere,
              enseignant:form.enseignant||"",
              salle:form.salle||"",
              type:typeCreneaux,
              primeRevision:typeCreneaux==="revision"?Number(form.primeRevision||0):null,
            };
            if(edtCellule.existing)modEmp({...data,_id:edtCellule.existing._id});
            else ajEmp(data);
            setEdtCellule(null);
          }}>✅ Enregistrer</Btn>
        </div>
      </div>
    </Modale>
  );
}
