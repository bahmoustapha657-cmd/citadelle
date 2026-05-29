import React, { useState, useEffect, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { apiFetch, getAuthHeaders } from "../apiClient";
import {
  C,
  genererMdp,
  getComptesDefautForSchool,
} from "../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, TD, THead, TR } from "./ui";
import { ROLES_SYSTEME_RESERVES, compteColor } from "./admin/admin-helpers";
import { AnneeScolaireCard } from "./admin/AnneeScolaireCard";
import { PromotionCard } from "./admin/PromotionCard";
import { RolesConfigCard } from "./admin/RolesConfigCard";
import { VerrousCard } from "./admin/VerrousCard";

// ══════════════════════════════════════════════════════════════
//  PANNEAU ADMIN — Gestion des mots de passe
// ══════════════════════════════════════════════════════════════
function AdminPanel({annee, setAnnee, verrous={}, schoolId, userRole}) {
  const peutGererRoles = userRole === "direction" || userRole === "superadmin";
  const peutResetCompte = (targetRole) => {
    if (userRole === "superadmin" || userRole === "direction") return true;
    if (userRole === "admin") return !ROLES_SYSTEME_RESERVES.has(targetRole);
    return false;
  };
  const {toast, schoolInfo, setSchoolInfo} = useContext(SchoolContext);
  const {items:comptes, chargement} = useFirestore("comptes");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [mdpsInitiaux, setMdpsInitiaux] = useState(null);
  const [initEnCours, setInitEnCours] = useState(false);
  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const comptesDefaut = getComptesDefautForSchool(schoolInfo);

  // Initialiser les comptes actifs manquants avec la configuration de l'école
  useEffect(() => {
    if (chargement || initEnCours) return;
    const comptesManquants = comptesDefaut.filter((compteDefaut) =>
      !comptes.some((compteExistant) => compteExistant.role === compteDefaut.role),
    );
    if (comptesManquants.length === 0) return;
    setInitEnCours(true);
    (async () => {
      const comptesCrees = [];
      for (const compteDefaut of comptesManquants) {
        const mdpClair = genererMdp();
        comptesCrees.push({
          login: compteDefaut.login,
          label: compteDefaut.label,
          role: compteDefaut.role,
          mdp: mdpClair,
        });
        try {
          const headers = await getAuthHeaders({"Content-Type":"application/json"});
          const res = await apiFetch("/account-manage", {
            method:"POST", headers,
            body:JSON.stringify({
              action:"create",
              schoolId,
              login:compteDefaut.login,
              mdp:mdpClair,
              role:compteDefaut.role,
              nom:compteDefaut.nom,
              label:compteDefaut.label,
              statut:"Actif",
            }),
          });
          const data = await res.json().catch(()=>({}));
          if(!res.ok||!data.ok) throw new Error(data.error||`Création du compte ${compteDefaut.login} impossible.`);
        } catch (e) {
          toast(e.message||"Erreur création comptes.", "error");
          setInitEnCours(false);
          return;
        }
      }
      if (comptesCrees.length > 0) setMdpsInitiaux(comptesCrees);
      setInitEnCours(false);
    })();
  }, [chargement, comptes, comptesDefaut, initEnCours, schoolId, toast]);

  const sauvegarder = async () => {
    if(!form.mdp || form.mdp.length < 8){
      toast("Le mot de passe doit contenir au moins 8 caractères.", "warning");
      return;
    }
    try{
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await apiFetch("/account-manage", {
        method:"POST",
        headers,
        body:JSON.stringify({
          action:"reset_password",
          schoolId,
          accountId:form._id,
          mdp:form.mdp,
        }),
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok||!data.ok) throw new Error(data.error||"Réinitialisation impossible.");
      toast(`Mot de passe réinitialisé pour ${form.nom}.`, "success");
      setModal(null);
    }catch(e){
      toast(e.message||"Erreur lors de la réinitialisation.", "error");
    }
  };

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Gestion des Accès</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Mots de passe & Année scolaire</p>
        </div>
      </div>

      <AnneeScolaireCard annee={annee} setAnnee={setAnnee} />

      <PromotionCard schoolId={schoolId} schoolInfo={schoolInfo} toast={toast} />

      <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.blueDark}}>
        <strong>🔐 Rôle Administrateur :</strong> par défaut en lecture seule. La Direction Générale peut autoriser l'écriture module par module (Primaire, Secondaire, Calendrier, Examens, Messages). Comptabilité, Paramètres, Fondation, Gestion Accès et Historique restent systématiquement en lecture seule (modules système).
        {!peutGererRoles && <div style={{marginTop:6,fontSize:12,color:"#6b7280"}}>La configuration des rôles et l'accès Fondation sont réservés à la Direction Générale.</div>}
      </div>

      {peutGererRoles && <RolesConfigCard
        schoolInfo={schoolInfo} setSchoolInfo={setSchoolInfo}
        schoolId={schoolId} toast={toast} setMdpsInitiaux={setMdpsInitiaux}
      />}

      {/* Modale mots de passe initiaux — affichée une seule fois */}
      {mdpsInitiaux&&<Modale titre="🔐 Comptes créés — Notez les mots de passe" fermer={null}>
        <p style={{fontSize:13,color:"#b91c1c",fontWeight:700,marginBottom:12}}>
          ⚠️ Ces mots de passe ne seront plus jamais affichés. Notez-les maintenant.
        </p>
        <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{marginBottom:16}}>
          <THead cols={["Login","Rôle","Mot de passe temporaire"]}/>
          <tbody>{mdpsInitiaux.map((compte)=>(
            <TR key={`${compte.role}-${compte.login}`}>
              <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{compte.login}</span></TD>
              <TD><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={compteColor(compte.role)}>{compte.label}</Badge></div></TD>
              <TD><span style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:C.blueDark,letterSpacing:"0.05em"}}>{compte.mdp}</span></TD>
            </TR>
          ))}</tbody>
        </table></div>
        <Btn v="success" onClick={()=>setMdpsInitiaux(null)}>✅ J'ai noté tous les mots de passe</Btn>
      </Modale>}

      {chargement||initEnCours ? <Chargement/> : (
        <Card>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={["Utilisateur","Login","Rôle","Mot de passe","Action"]}/>
            <tbody>
              {comptes.map((c,i)=>{
                const reserve = !peutResetCompte(c.role);
                return (
                <TR key={c._id||i}>
                  <TD bold>{c.nom}</TD>
                  <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{c.login}</span></TD>
                  <TD><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={compteColor(c.role)}>{c.label}</Badge>{c.statut && c.statut!=="Actif" && <Badge color="gray">Inactif</Badge>}</div></TD>
                  <TD>
                    <Badge color="vert">🔒 Sécurisé</Badge>
                  </TD>
                  <TD>
                    {c._id && (reserve
                      ? <span title="Seule la Direction Générale peut réinitialiser ce compte" style={{fontSize:11,color:"#6b7280",fontStyle:"italic"}}>🛡️ Réservé Direction</span>
                      : <Btn sm onClick={()=>{setForm({...c,mdp:""});setModal("mdp");}}>✏️ Modifier</Btn>
                    )}
                  </TD>
                </TR>
                );
              })}
            </tbody>
          </table></div>
        </Card>
      )}

      {/* ── CONTRÔLE DES MODIFICATIONS — réservé direction (verrou pose la
              question du droit de modifier des enregistrements déjà saisis ;
              les rules ecoles/{id} update interdisent toute modif sauf direction) ── */}
      {peutGererRoles && <VerrousCard verrous={verrous} schoolId={schoolId} />}

      {modal==="mdp" && (
        <Modale titre={`Modifier le mot de passe — ${form.nom}`} fermer={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Input label="Nouveau mot de passe" type="text" value={form.mdp||""} onChange={chg("mdp")}/>
            <div style={{background:"#fef3e0",padding:"10px 14px",borderRadius:8,fontSize:12,color:"#92400e"}}>
              Attention Communiquez ce mot de passe directement a l'utilisateur concerne.
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={sauvegarder}>Enregistrer</Btn>
          </div>
        </Modale>
      )}
    </div>
  );
}

export { AdminPanel };
