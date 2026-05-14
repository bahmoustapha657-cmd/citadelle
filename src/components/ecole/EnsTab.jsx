import React from "react";
import { useTranslation } from "react-i18next";
import { C, genererMdp } from "../../constants";
import { Badge, Btn, Card, Champ, Chargement, Input, Modale, Selec, UploadFichiers, Vide } from "../ui";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { getTeacherMonthlyForfait } from "../../teacher-utils";

export function EnsTab({
  ens,
  cEns,
  supEns,
  cleEns,
  isPrimarySection,
  couleur,
  schoolId,
  toast,
  logAction,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  ensCompte,
  setEnsCompte,
  formC,
  setFormC,
  saveEnseignant,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const chgC = (k) => (e) => setFormC((p) => ({ ...p, [k]: e.target.value }));
  const sectionEns = cleEns.includes("Lycee") ? "lycee" : cleEns.includes("College") ? "college" : "primaire";

  const creerCompteEns = async () => {
    if(!formC.login?.trim()){toast("Identifiant requis.","warning");return;}
    if(!formC.mdp||formC.mdp.length<8){toast("Mot de passe minimum 8 caractères.","warning");return;}
    try{
      const nomComplet=`${ensCompte.prenom||""} ${ensCompte.nom||""}`.trim();
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await apiFetch("/account-manage",{
        method:"POST",
        headers,
        body:JSON.stringify({
          action:"create",
          schoolId,
          login:formC.login.trim().toLowerCase(),
          mdp:formC.mdp,
          role:"enseignant",
          label:"Enseignant",
          nom:nomComplet,
          enseignantId:ensCompte._id,
          enseignantNom:nomComplet,
          section:sectionEns,
          sections:[sectionEns],
          matiere:ensCompte.matiere||"",
          statut:"Actif",
        }),
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok||!data.ok) throw new Error(data.error||"Création du compte impossible.");
      toast(`Compte enseignant créé — ID : ${formC.login} · L'enseignant changera son mot de passe à la 1ère connexion.`,"success");
      logAction("Compte enseignant créé",`Login: ${formC.login} · ${nomComplet}`);
      setEnsCompte(null);
    }catch(e){toast("Erreur : "+e.message,"error");}
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <strong style={{fontSize:14,color:C.blueDark}}>{t("school.teachers.title")} ({ens.length})</strong>
      {canCreate&&<Btn onClick={()=>{setForm({statut:"Titulaire"});setModal("add_ens");}}>+ {t("common.add")}</Btn>}
    </div>
    {cEns?<Chargement/>:ens.length===0?<Vide icone="👨‍🏫" msg={t("school.teachers.noTeacher")}/>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
        {ens.map(e=><Card key={e._id}><div style={{padding:"14px 15px"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
            <div style={{width:38,height:38,borderRadius:8,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff"}}>
              {(e.prenom||"?")[0]}{(e.nom||"?")[0]}
            </div>
            <Badge color={e.statut==="Titulaire"?"vert":"amber"}>{e.statut}</Badge>
          </div>
          <p style={{margin:"0 0 1px",fontWeight:800,fontSize:13,color:C.blueDark}}>{e.prenom} {e.nom}</p>
          <p style={{margin:"0 0 4px",fontSize:12,color:couleur,fontWeight:700}}>
            {isPrimarySection
              ? `Forfait ${Number(getTeacherMonthlyForfait(e) || 0).toLocaleString("fr-FR")} GNF`
              : e.matiere}
          </p>
          <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.grade} · {e.telephone}</p>
          {(e.fichiers||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
            {e.fichiers.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.blue,background:"#e0ebf8",padding:"2px 5px",borderRadius:3}}>📎 {f.nom}</a>)}
          </div>}
          {canEdit&&<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens");}}>✏️ Modifier</Btn>
            <Btn sm v="purple" onClick={()=>{
              const loginSuggere=`${(e.prenom||"").toLowerCase().replace(/\s+/g,"")}${e.nom?"."+e.nom.toLowerCase().replace(/\s+/g,""):""}`;
              setEnsCompte(e);
              setFormC({login:loginSuggere,mdp:genererMdp()});
            }}>🔑 Compte</Btn>
            <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEns(e._id);}}>🗑</Btn>
          </div>}
        </div></Card>)}
      </div>}

    {/* Modal compte enseignant */}
    {ensCompte&&<Modale titre={`Compte — ${ensCompte.prenom} ${ensCompte.nom}`} fermer={()=>setEnsCompte(null)}>
      <div style={{marginBottom:14,padding:"10px 14px",background:"#f5f3ff",borderRadius:10,fontSize:12,color:"#6d28d9"}}>
        <strong>Section :</strong> {sectionEns} &nbsp;|&nbsp; <strong>Matière :</strong> {ensCompte.matiere||"—"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
        <Input label="Identifiant de connexion" value={formC.login||""} onChange={chgC("login")} placeholder="ex: jean.dupont"/>
        <Champ label="Mot de passe initial">
          <div style={{display:"flex",gap:8}}>
            <input value={formC.mdp||""} onChange={chgC("mdp")}
              style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
            <Btn sm v="ghost" onClick={()=>setFormC(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
          </div>
        </Champ>
      </div>
      <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
        ⚠️ Notez ces identifiants avant de valider — le mot de passe ne sera plus visible ensuite.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setEnsCompte(null)}>Annuler</Btn>
        <Btn v="purple" onClick={creerCompteEns}>✅ Créer le compte</Btn>
      </div>
    </Modale>}

    {(modal==="add_ens"&&canCreate||(modal==="edit_ens"&&canEdit))&&<Modale titre={modal==="add_ens"?"Nouvel enseignant":"Modifier"} fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
        <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
        <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
        <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
        <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
        <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
          <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
        </Selec>
        <div style={{gridColumn:"1/-1"}}>
          <Input label="Classe (titulaire)" value={form.classeTitle||""} onChange={chg("classeTitle")} placeholder="Ex : 3ème Année A — laissez vide si non titulaire"/>
        </div>
      </div>
      <div style={{marginTop:14,padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af"}}>
        <strong>Paie gérée par la Comptabilité.</strong> Les forfaits, primes horaires et primes par classe se renseignent dans <em>Comptabilité &gt; Enseignants</em>.
      </div>
      <UploadFichiers dossier={`enseignants/${cleEns}`} fichiers={form.fichiers||[]}
        onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
        onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={saveEnseignant}>Enregistrer</Btn>
      </div>
    </Modale>}
  </div>;
}
