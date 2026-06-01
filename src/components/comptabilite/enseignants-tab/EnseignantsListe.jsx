import { useTranslation } from "react-i18next";
import { C, fmtN } from "../../../constants";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../../ui";

// En-tête + bandeau d'aide + statistiques par section + tableau des
// enseignants (identité et paie).
export function EnseignantsListe({ ensTous, ensPrimaire, ensCollege, ensLycee, canCreate, canEdit, setForm, setModal, supEnsForSection }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("accounting.tabs.teachers")} ({ensTous.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({_section:"Primaire",statut:"Titulaire"});setModal("add_ens_compta");}}>+ {t("common.add")}</Btn>}
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
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
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
        </table></div></Card>
      }
    </>
  );
}
