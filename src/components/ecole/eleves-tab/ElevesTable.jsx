import { C } from "../../../constants";
import { Badge, Btn, Chargement, TD, THead, TR, Vide } from "../../ui";
import { imprimerCartesEleves } from "../../../reports";
import { peutImprimerCartesEleves } from "../../../../shared/postes-config.js";

// Tableau des élèves filtrés ; dernière colonne = actions sur l'élève
// (carte scolaire, création de compte parent).
export function ElevesTable({
  cE, elevesFiltres, peutCreerParent, ouvrirCompte, t,
  schoolInfo = {}, annee = "", userRole = "",
}) {
  // Même règle que la planche complète de la barre d'outils : la carte est une
  // pièce d'identité, fermée au surveillant général.
  const peutCarte = peutImprimerCartesEleves(userRole);
  if (cE) return <Chargement/>;
  if (elevesFiltres.length===0) return <Vide icone="🎓" msg={t("school.students.noStudent")}/>;
  return (
    <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:900}}>
        <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Date Nais.","Lieu Nais.","Filiation","Tuteur","Contact","Domicile","Documents","Statut","Actions"]}/>
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
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {/* Carte de CET élève : la planche complète reste dans la barre
                  d'outils. On réimprime rarement une classe entière — c'est
                  presque toujours une carte perdue ou un nouvel arrivant. */}
              {peutCarte&&<Btn sm v="blue" title={`Imprimer la carte de ${e.nom} ${e.prenom}`}
                onClick={()=>imprimerCartesEleves([e],schoolInfo,annee)}>🪪 Carte</Btn>}
              {peutCreerParent&&<Btn sm v="purple" onClick={()=>ouvrirCompte(e)}>👨‍👩‍👧 Compte</Btn>}
            </div>
          </TD>
        </TR>)}</tbody>
      </table>
    </div>
  );
}
