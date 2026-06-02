import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide, UploadFichiers } from "../ui";

// Onglet Documents officiels : table des documents + modale d'ajout/édition.
export function FondationDocs({
  docs, cD, readOnly, canEdit, supD, ajD, modD,
  form, setForm, chg, modal, setModal, sauvegarder,
}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>Documents officiels ({docs.length})</strong>
        {!readOnly&&<Btn onClick={()=>{setForm({statut:"Valide"});setModal("add_d");}}>+ Ajouter</Btn>}
      </div>
      {cD?<Chargement/>:docs.length===0?<Vide icone="📄" msg="Aucun document"/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={["Document","Type","Date","Statut","Fichier",canEdit?"Actions":""]}/>
          <tbody>{docs.map(d=><TR key={d._id}>
            <TD bold>{d.titre}</TD><TD><Badge color="gray">{d.type}</Badge></TD><TD>{d.date}</TD>
            <TD><Badge color={["Valide","En vigueur","Actif"].includes(d.statut)?"vert":"amber"}>{d.statut}</Badge></TD>
            <TD>{d.fichierUrl&&<a href={d.fichierUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:C.blue}}>📎 Voir</a>}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d");}}>Modifier</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supD(d._id);}}>Suppr.</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></div></Card>}

      {(modal==="add_d"||modal==="edit_d")&&!readOnly&&<Modale titre={modal==="add_d"?"Nouveau document":"Modifier"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Titre" value={form.titre||""} onChange={chg("titre")}/></div>
          <Selec label="Type" value={form.type||""} onChange={chg("type")}><option>Juridique</option><option>Administratif</option><option>Pédagogique</option><option>Stratégique</option></Selec>
          <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label="Statut" value={form.statut||"Valide"} onChange={chg("statut")}><option>Valide</option><option>En vigueur</option><option>Actif</option><option>Expiré</option></Selec>
        </div>
        <UploadFichiers dossier="documents" fichiers={form.fichiers||[]}
          onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
          onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>sauvegarder(ajD,modD)}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
