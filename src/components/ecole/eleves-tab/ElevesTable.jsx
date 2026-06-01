import { C } from "../../../constants";
import { Badge, Btn, Chargement, TD, THead, TR, Vide } from "../../ui";

// Tableau des élèves filtrés ; dernière colonne = bouton de création de
// compte parent (si autorisé).
export function ElevesTable({ cE, elevesFiltres, peutCreerParent, ouvrirCompte, t }) {
  if (cE) return <Chargement/>;
  if (elevesFiltres.length===0) return <Vide icone="🎓" msg={t("school.students.noStudent")}/>;
  return (
    <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:900}}>
        <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Date Nais.","Lieu Nais.","Filiation","Tuteur","Contact","Domicile","Documents","Statut","Accès"]}/>
        <tbody>{elevesFiltres.map(e=><TR key={e._id}>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
          <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
          <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
          <TD>{e.dateNaissance||"—"}</TD>
          <TD>{e.lieuNaissance||"—"}</TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
          <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
          <TD>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(e.fichiers||[]).map((f,i)=>(
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,background:"#e0ebf8",padding:"2px 6px",borderRadius:4}}>📎 {f.nom}</a>
              ))}
              {(e.fichiers||[]).length===0&&<span style={{fontSize:11,color:"#9ca3af"}}>—</span>}
            </div>
          </TD>
          <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
          <TD>
            {peutCreerParent&&<Btn sm v="purple" onClick={()=>ouvrirCompte(e)}>👨‍👩‍👧 Compte</Btn>}
          </TD>
        </TR>)}</tbody>
      </table>
    </div>
  );
}
