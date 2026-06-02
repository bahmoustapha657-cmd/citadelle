import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide, UploadFichiers } from "../ui";

// Onglet Membres du CA : table des membres + modale d'ajout/édition.
export function FondationMembres({
  membres, cM, readOnly, canEdit, supM, ajM, modM,
  form, setForm, chg, modal, setModal, sauvegarder,
}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Membres du CA ({membres.length})</strong>
        {!readOnly&&<Btn onClick={()=>{setForm({statut:"Membre"});setModal("add_m");}}>+ Ajouter</Btn>}
      </div>
      {cM?<Chargement/>:membres.length===0?<Vide icone="👥" msg="Aucun membre"/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Nom & Prénom","Rôle","Statut","Téléphone","Documents",canEdit?"Actions":""]}/>
          <tbody>{membres.map(m=><TR key={m._id}>
            <TD bold>{m.prenom} {m.nom}</TD><TD>{m.role}</TD>
            <TD><Badge color={m.statut==="Fondateur"?"purple":"blue"}>{m.statut}</Badge></TD>
            <TD>{m.telephone}</TD>
            <TD>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {(m.fichiers||[]).map((f,i)=>(
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,background:"#e0ebf8",padding:"2px 6px",borderRadius:4}}>📎 {f.nom}</a>
                ))}
              </div>
            </TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...m});setModal("edit_m");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supM(m._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></div></Card>}

      {(modal==="add_m"||modal==="edit_m")&&!readOnly&&<Modale titre={modal==="add_m"?"Nouveau membre":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
          <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
          <Input label="Rôle" value={form.role||""} onChange={chg("role")}/>
          <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
          <Selec label="Statut" value={form.statut||"Membre"} onChange={chg("statut")}>
            <option>Fondateur</option><option>Membre</option><option>Observateur</option>
          </Selec>
        </div>
        <UploadFichiers dossier="membres" fichiers={form.fichiers||[]}
          onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
          onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>sauvegarder(ajM,modM)}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
