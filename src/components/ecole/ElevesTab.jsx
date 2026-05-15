import React from "react";
import { useTranslation } from "react-i18next";
import { C, genererMdp } from "../../constants";
import { Badge, Btn, Card, Champ, Chargement, Input, Modale, TD, THead, TR, Vide } from "../ui";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { imprimerCartesEleves, imprimerListeClasse, exportExcel } from "../../reports";

export function ElevesTab({
  eleves,
  elevesFiltres,
  cE,
  cleEleves,
  filtreClasse,
  setFiltreClasse,
  classesUniq,
  avecEns,
  annee,
  schoolInfo,
  schoolId,
  toast,
  logAction,
  canEdit,
  parentEleve,
  setParentEleve,
  formP,
  setFormP,
}) {
  const { t } = useTranslation();
  const chgP = (k) => (e) => setFormP((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.students.title")} ({eleves.length})</strong>
        <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option value="all">{t("common.all")}</option>
          {classesUniq.map(c=><option key={c}>{c}</option>)}
        </select>
        {filtreClasse!=="all"&&<Btn sm v="ghost" onClick={()=>imprimerListeClasse(filtreClasse,eleves,schoolInfo)}>🖨️ {t("common.print")}</Btn>}
        <Btn sm v="blue" onClick={()=>imprimerCartesEleves(elevesFiltres,schoolInfo,annee)}>🪪 {t("reports.card.title")}</Btn>
        <Btn sm v="ghost" onClick={()=>exportExcel(
          `${t("reports.excel.files.students")}_${avecEns?"College":"Primaire"}`,
          [t("reports.excel.headers.matricule"),t("reports.excel.headers.ien"),t("reports.excel.headers.lastName"),t("reports.excel.headers.firstName"),t("reports.excel.headers.class"),t("reports.excel.headers.sex"),t("reports.excel.headers.dateOfBirth"),t("reports.excel.headers.birthPlace"),t("reports.excel.headers.filiation"),t("reports.excel.headers.guardian"),t("reports.excel.headers.contact"),t("reports.excel.headers.domicile"),t("reports.excel.headers.status")],
          elevesFiltres.map(e=>[e.matricule||"",e.ien||"",e.nom,e.prenom,e.classe,e.sexe||"",e.dateNaissance||"",e.lieuNaissance||"",e.filiation||"",e.tuteur||"",e.contactTuteur||"",e.domicile||"",e.statut||t("school.students.active")])
        )}>📥 {t("common.export")} Excel</Btn>
      </div>
      {cE?<Chargement/>:elevesFiltres.length===0?<Vide icone="🎓" msg={t("school.students.noStudent")}/>
        :<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
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
                {canEdit&&<Btn sm v="purple" onClick={()=>{
                  const loginSuggere=`parent.${(e.nom||"").toLowerCase().replace(/\s+/g,"").slice(0,12)}`;
                  setParentEleve(e);
                  setFormP({login:loginSuggere, mdp:genererMdp()});
                }}>👨‍👩‍👧 Compte</Btn>}
              </TD>
            </TR>)}</tbody>
          </table>
        </div>}

      {/* Modal creation compte parent */}
      {parentEleve&&<Modale titre={`Compte parent - ${parentEleve.prenom} ${parentEleve.nom}`} fermer={()=>setParentEleve(null)}>
        <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>Tuteur</span>
          <span><strong>{parentEleve.prenom} {parentEleve.nom}</strong> - Classe {parentEleve.classe} - Tuteur : {parentEleve.tuteur||"-"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
          <Input label="Identifiant de connexion" value={formP.login||""} onChange={chgP("login")} placeholder="ex: parent.dupont"/>
          <Champ label="Mot de passe initial">
            <div style={{display:"flex",gap:8}}>
              <input value={formP.mdp||""} onChange={chgP("mdp")}
                style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
              <Btn sm v="ghost" onClick={()=>setFormP(p=>({...p,mdp:genererMdp()}))}>Regenerer</Btn>
            </div>
          </Champ>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
          Notez ces identifiants avant de valider. Si un compte parent existe deja pour le meme tuteur et la meme filiation, l'eleve sera rattache a ce compte.
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setParentEleve(null)}>Annuler</Btn>
          <Btn v="purple" onClick={async()=>{
            if(!formP.login?.trim()){toast("Identifiant requis.","warning");return;}
            if(!formP.mdp||formP.mdp.length<8){toast("Mot de passe minimum 8 caracteres.","warning");return;}
            try{
              const section=cleEleves.includes("Primaire")?"primaire":cleEleves.includes("Lycee")?"lycee":"college";
              const headers = await getAuthHeaders({"Content-Type":"application/json"});
              const res = await apiFetch("/account-manage",{
                method:"POST",
                headers,
                body:JSON.stringify({
                  action:"create",
                  schoolId,
                  login:formP.login.trim().toLowerCase(),
                  mdp:formP.mdp,
                  role:"parent",
                  label:"Parent",
                  nom:(parentEleve.tuteur||`Parent de ${parentEleve.prenom}`),
                  eleveId:parentEleve._id,
                  eleveNom:`${parentEleve.prenom} ${parentEleve.nom}`,
                  eleveClasse:parentEleve.classe||"",
                  section,
                  sections:[section],
                  eleveIds:[parentEleve._id],
                  elevesAssocies:[{
                    eleveId:parentEleve._id,
                    eleveNom:`${parentEleve.prenom} ${parentEleve.nom}`,
                    eleveClasse:parentEleve.classe||"",
                    section,
                  }],
                  tuteur:parentEleve.tuteur||"",
                  contactTuteur:parentEleve.contactTuteur||"",
                  filiation:parentEleve.filiation||"",
                  statut:"Actif",
                }),
              });
              const data = await res.json().catch(()=>({}));
              if(!res.ok||!data.ok) throw new Error(data.error||"Creation du compte impossible.");
              const loginUtilise = data.compte?.login || formP.login;
              if(data.merged || data.mergedIntoExisting){
                toast(`${parentEleve.prenom} a ete rattache au compte parent ${loginUtilise}. Le mot de passe actuel est conserve.`,"success");
                logAction("Eleve rattache compte parent",`Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
              } else {
                toast(`Compte parent cree - ID : ${loginUtilise}. Remettez-le au tuteur de ${parentEleve.prenom}.`,"success");
                logAction("Compte parent cree",`Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
              }
              setParentEleve(null);
            }catch(e){toast("Erreur : "+e.message,"error");}
          }}>Creer le compte</Btn>
        </div>
      </Modale>}
    </div>
  );
}
