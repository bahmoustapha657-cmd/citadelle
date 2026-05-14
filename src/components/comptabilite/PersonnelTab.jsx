import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function PersonnelTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  personnel,
  cPers,
  supPers,
  savePersonnel,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("accounting.tabs.staff")} ({personnel.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({statut:"Actif"});setModal("add_p");}}>+ {t("common.add")}</Btn>}
      </div>

      {/* Cartes résumé */}
      {personnel.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(cat=>{
          const n=personnel.filter(p=>p.categorie===cat).length;
          if(!n) return null;
          return <div key={cat} style={{background:"#f5f3ff",borderRadius:10,padding:"12px 14px",textAlign:"center",border:"1px solid #ddd6fe"}}>
            <div style={{fontSize:11,color:"#7c3aed",fontWeight:700,marginBottom:4}}>{cat}</div>
            <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{n}</div>
          </div>;
        })}
        <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"12px 14px",textAlign:"center",color:"#fff"}}>
          <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Masse mensuelle</div>
          <div style={{fontSize:16,fontWeight:900}}>{(personnel.reduce((s,p)=>s+Number(p.salaireBase||0),0)/1e6).toFixed(3)}M</div>
          <div style={{fontSize:10,opacity:.75}}>GNF</div>
        </div>
      </div>}

      {cPers?<Chargement/>:personnel.length===0?<Vide icone="👥" msg={t("common.empty")}/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Prénoms et Nom","Poste","Catégorie","Salaire de base","Statut","Observation",canEdit?"Actions":""]}/>
          <tbody>{personnel.map(p=><TR key={p._id}>
            <TD bold>{p.prenom||""} {p.nom||""}</TD>
            <TD>{p.poste||"—"}</TD>
            <TD><Badge color="purple">{p.categorie||"—"}</Badge></TD>
            <TD center>{fmtN(p.salaireBase||0)}</TD>
            <TD><Badge color={p.statut==="Actif"?"vert":"gray"}>{p.statut||"Actif"}</Badge></TD>
            <TD>{p.observation||"—"}</TD>
            {canEdit&&<TD center>
              <Btn sm v="ghost" onClick={()=>{setForm({...p});setModal("edit_p");}}>✏️</Btn>
              <Btn sm v="red" onClick={()=>confirm("Supprimer cet employé ?")&&supPers(p._id)}>🗑</Btn>
            </TD>}
          </TR>)}
          <tr style={{background:"#ede9fe",fontWeight:800}}>
            <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#7c3aed"}}>TOTAL MASSE MENSUELLE</td>
            <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>
              {fmtN(personnel.filter(p=>(p.statut||"Actif")==="Actif").reduce((s,p)=>s+Number(p.salaireBase||0),0))}
            </td>
            <td colSpan={canEdit?3:2}></td>
          </tr>
          </tbody>
        </table></Card>
      }

      {/* MODAL PERSONNEL */}
      {(modal==="add_p"&&canCreate||(modal==="edit_p"&&canEdit))&&<Modale large titre={modal==="add_p"?"Nouvel employé":"Modifier l'employé"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
          <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
          <Input label="Poste" value={form.poste||""} onChange={chg("poste")} placeholder="Ex : Gardien, Secrétaire…"/>
          <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}>
            <option value="">— Catégorie —</option>
            {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(c=><option key={c}>{c}</option>)}
          </Selec>
          <Input label="Salaire mensuel de base (GNF)" type="number" value={form.salaireBase||""} onChange={chg("salaireBase")} placeholder="Ex : 500000"/>
          <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
            <option>Actif</option><option>Inactif</option>
          </Selec>
          <div style={{gridColumn:"1/-1"}}><Input label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#f5f3ff",borderRadius:8,fontSize:12,color:"#7c3aed"}}>
          Le salaire de base sera repris automatiquement lors de la génération mensuelle des salaires.
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={savePersonnel}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
