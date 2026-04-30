import React, { useState, useEffect, useContext } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { db } from "../firebaseDb";
import {
  ACCES,
  C,
  ROLE_IDS_PERSONNALISABLES,
  TOUTES_ANNEES,
  genererMdp,
  getComptesDefautForSchool,
  getModuleOptionsForRole,
  getRoleSettingsForSchool,
  normalizeRoleLogin,
} from "../constants";
import { getGeneralAverage } from "../note-utils";
import { Badge, Btn, Card, Chargement, Input, Modale, TD, THead, TR } from "./ui";

// ══════════════════════════════════════════════════════════════
//  PANNEAU ADMIN — Gestion des mots de passe
// ══════════════════════════════════════════════════════════════
// Mapping promotion classes : quelle classe vient apres quelle classe
const PROMOTION_SUIVANTE = {
  // Primaire (classique)
  "Maternelle A":"1ere Annee A","Maternelle B":"1ere Annee B",
  "1ere Annee A":"2eme Annee A","1ere Annee B":"2eme Annee B",
  "2eme Annee A":"3eme Annee A","2eme Annee B":"3eme Annee B",
  "3eme Annee A":"4eme Annee A","3eme Annee B":"4eme Annee B",
  "4eme Annee A":"5eme Annee A","4eme Annee B":"5eme Annee B",
  "5eme Annee A":"6eme Annee A","5eme Annee B":"6eme Annee B",
  // College
  "6eme A":"5eme A","6eme B":"5eme B","6eme C":"5eme C",
  "5eme A":"4eme A","5eme B":"4eme B","5eme C":"4eme C",
  "4eme A":"3eme A","4eme B":"3eme B","4eme C":"3eme C",
  // Lycee
  "Seconde A":"Premiere A","Seconde B":"Premiere B","Seconde C":"Premiere C",
  "Premiere A":"Terminale A","Premiere B":"Terminale B","Premiere C":"Terminale C",
};

const ROLES_SYSTEME_RESERVES = new Set(["direction", "admin", "comptable", "primaire", "college"]);

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
  const [savingVerrou, setSavingVerrou] = useState(null);
  const [mdpsInitiaux, setMdpsInitiaux] = useState(null);
  const [initEnCours, setInitEnCours] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [promoEn, setPromoEn] = useState(false);
  const [promoRes, setPromoRes] = useState(null);
  const [promoModal, setPromoModal] = useState(false);
  const [seuilCollege, setSeuilCollege] = useState(10);
  const [seuilPrimaire, setSeuilPrimaire] = useState(5);
  const [sansNotesBehavior, setSansNotesBehavior] = useState("promouvoir"); // "promouvoir" | "redoubler"
  const [roleConfigForm, setRoleConfigForm] = useState(() => getRoleSettingsForSchool(schoolInfo));
  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const comptesDefaut = getComptesDefautForSchool(schoolInfo);

  const schoolRoleSettings = schoolInfo.roleSettings;

  useEffect(() => {
    setRoleConfigForm(getRoleSettingsForSchool({ roleSettings: schoolRoleSettings }));
  }, [schoolRoleSettings]);
  const compteColor = (role) => (role === "admin" ? "purple" : role === "comptable" ? "teal" : role === "direction" ? "blue" : "vert");
  const majRoleConfig = (role, field, value) => {
    setRoleConfigForm((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
  };
  const toggleModuleRole = (role, moduleId) => {
    setRoleConfigForm((prev) => {
      const currentModules = prev[role]?.modules || [];
      const nextModules = currentModules.includes(moduleId)
        ? currentModules.filter((currentModuleId) => currentModuleId !== moduleId)
        : [...currentModules, moduleId];
      return {
        ...prev,
        [role]: {
          ...prev[role],
          modules: nextModules,
        },
      };
    });
  };

  // Calcule la moyenne annuelle d'un eleve a partir de ses notes (toutes periodes)
  const calcMoyenneAnnuelle = (notes, classe, matieres) => {
    if(!notes || notes.length===0) return null;
    const periodes = ["T1", "T2", "T3"];
    const moyennes = periodes
      .map((periode) => getGeneralAverage(notes.filter((note) => note.periode === periode), matieres, classe))
      .filter((value) => value != null);
    if(!moyennes.length) return null;
    return moyennes.reduce((sum, value) => sum + value, 0) / moyennes.length;
  };

  const lancerPromotion = async () => {
    setPromoModal(false);
    setPromoEn(true);
    try {
      const SECTIONS = [
        {eleves:"elevesCollege",  notes:"notesCollege",  seuil:Number(seuilCollege),  maxNote:20},
        {eleves:"elevesPrimaire", notes:"notesPrimaire", seuil:Number(seuilPrimaire), maxNote:10},
        {eleves:"elevesLycee",    notes:"notesLycee",    seuil:Number(seuilCollege),  maxNote:20},
      ];
      let total=0, promus=0, redoublants=0, terminalistes=0, sansNotes=0;
      const details = []; // pour affichage resultats
      for(const sec of SECTIONS) {
        const [snapEleves, snapNotes] = await Promise.all([
          getDocs(collection(db,"ecoles",schoolId,sec.eleves)),
          getDocs(collection(db,"ecoles",schoolId,sec.notes)),
        ]);
        const notesToutes = snapNotes.docs.map(d=>({...d.data(),_id:d.id}));
        for(const d of snapEleves.docs) {
          const e = d.data();
          if(e.statut!=="Actif") continue;
          total++;
          const classeActuelle = e.classe||"";
          const classeSuivante = PROMOTION_SUIVANTE[classeActuelle];
          if(!classeSuivante) { terminalistes++; continue; }
          // Notes de cet eleve
          const notesEleve = notesToutes.filter(n=>n.eleveId===d.id);
          const matieresEleve = [...new Set(notesEleve.map((note) => note.matiere).filter(Boolean))].map((nom) => ({ nom }));
          const moy = calcMoyenneAnnuelle(notesEleve, classeActuelle, matieresEleve);
          let decision;
          if(moy===null) {
            sansNotes++;
            decision = sansNotesBehavior;
          } else {
            decision = moy >= sec.seuil ? "promouvoir" : "redoubler";
          }
          if(decision==="promouvoir") {
            await updateDoc(doc(db,"ecoles",schoolId,sec.eleves,d.id),{classe:classeSuivante});
            promus++;
            details.push({nom:`${e.nom} ${e.prenom}`,classe:classeActuelle,nouvClasse:classeSuivante,moy,statut:"promu"});
          } else {
            redoublants++;
            details.push({nom:`${e.nom} ${e.prenom}`,classe:classeActuelle,nouvClasse:null,moy,statut:"redoublant"});
          }
        }
      }
      setPromoRes({total,promus,redoublants,terminalistes,sansNotes,details});
      toast(`Promotion terminee — ${promus} promus, ${redoublants} redoublants`, "success");
    } catch(e) {
      toast("Erreur lors de la promotion : "+e.message, "error");
    } finally {
      setPromoEn(false);
    }
  };

  const toggleVerrou = async (cle) => {
    setSavingVerrou(cle);
    try {
      const nvVal = !verrous[cle];
      await updateDoc(doc(db,"ecoles",schoolId), { [`verrous.${cle}`]: nvVal });
    } finally { setSavingVerrou(null); }
  };

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

  const sauvegarderRoles = async () => {
    const preparedRoleSettings = ROLE_IDS_PERSONNALISABLES.reduce((accumulator, role) => {
      const config = roleConfigForm[role];
      accumulator[role] = {
        ...config,
        login: normalizeRoleLogin(config?.login, role),
      };
      return accumulator;
    }, {});

    const loginsActifs = Object.values(preparedRoleSettings)
      .filter((config) => config.active !== false)
      .map((config) => config.login);
    const doublons = loginsActifs.filter((login, index) => loginsActifs.indexOf(login) !== index);
    if (doublons.length > 0) {
      toast(`Identifiants en doublon : ${[...new Set(doublons)].join(", ")}`, "warning");
      return;
    }

    setSavingRoles(true);
    try {
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await apiFetch("/account-manage", {
        method:"POST",
        headers,
        body:JSON.stringify({
          action:"sync_role_settings",
          schoolId,
          roleSettings: preparedRoleSettings,
        }),
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok||!data.ok) throw new Error(data.error||"Synchronisation des comptes impossible.");
      const roleSettings = getRoleSettingsForSchool(data.roleSettings || preparedRoleSettings);
      setRoleConfigForm(roleSettings);
      setSchoolInfo((prev) => ({ ...prev, roleSettings }));
      if(Array.isArray(data.generatedAccounts) && data.generatedAccounts.length > 0){
        setMdpsInitiaux(data.generatedAccounts);
      }
      toast("Configuration des comptes mise à jour.", "success");
    } catch(e) {
      toast(e.message || "Erreur de configuration des comptes.", "error");
    } finally {
      setSavingRoles(false);
    }
  };

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

      {/* ── GESTION ANNÉE SCOLAIRE ── */}
      <Card style={{marginBottom:20,padding:"16px 20px"}}>
        <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année scolaire</p>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <select value={annee} onChange={e=>setAnnee(e.target.value)}
            style={{border:"2px solid "+C.blue,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:800,color:C.blueDark,background:"#fff"}}>
            {TOUTES_ANNEES.map(a=><option key={a}>{a}</option>)}
          </select>
          <Btn v="success" onClick={()=>{
            const idx=TOUTES_ANNEES.indexOf(annee);
            if(idx<TOUTES_ANNEES.length-1)setAnnee(TOUTES_ANNEES[idx+1]);
          }}>▶ Année suivante</Btn>
          <Btn v="ghost" onClick={()=>{
            const idx=TOUTES_ANNEES.indexOf(annee);
            if(idx>0)setAnnee(TOUTES_ANNEES[idx-1]);
          }}>◀ Année précédente</Btn>
          <span style={{fontSize:13,color:C.green,fontWeight:700}}>Année active : <strong>{annee}</strong></span>
        </div>
        <p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>Attention : changer l'année affecte tous les modules de l'application.</p>
      </Card>

      {/* ── PROMOTION FIN D'ANNÉE ── */}
      <Card style={{marginBottom:20,padding:"16px 20px",border:"2px solid #fef3c7"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <span style={{fontSize:28}}>Promotion</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Promotion de fin d'année</p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
              Avance les élèves dont la moyenne annuelle atteint le seuil de passage. Les autres redoublent.
            </p>
            {promoRes&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
                <div style={{background:"#dcfce7",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>{promoRes.promus}</div>
                  <div style={{fontSize:11,color:"#15803d"}}>OK Promus</div>
                </div>
                <div style={{background:"#fee2e2",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#b91c1c"}}>{promoRes.redoublants}</div>
                  <div style={{fontSize:11,color:"#b91c1c"}}>🔁 Redoublants</div>
                </div>
                <div style={{background:"#fef9c3",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#854d0e"}}>{promoRes.terminalistes}</div>
                  <div style={{fontSize:11,color:"#854d0e"}}>🏁 Fin de cycle</div>
                </div>
                {promoRes.sansNotes>0&&<div style={{background:"#f3f4f6",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#6b7280"}}>{promoRes.sansNotes}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>📭 Sans notes</div>
                </div>}
              </div>
              {promoRes.details&&promoRes.details.length>0&&<details style={{marginBottom:12}}>
                <summary style={{fontSize:12,cursor:"pointer",color:C.blue,fontWeight:700}}>
                  Voir le détail ({promoRes.details.length} élèves)
                </summary>
                <div style={{overflowX:"auto",marginTop:8}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#f0f6ff"}}>
                      <th style={{padding:"5px 8px",textAlign:"left"}}>Éleve</th>
                      <th style={{padding:"5px 8px"}}>Classe actuelle</th>
                      <th style={{padding:"5px 8px"}}>Moy. annuelle</th>
                      <th style={{padding:"5px 8px"}}>Décision</th>
                      <th style={{padding:"5px 8px"}}>Nouvelle classe</th>
                    </tr></thead>
                    <tbody>{promoRes.details.map((d,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #e5e7eb",background:d.statut==="promu"?"#f0fdf4":"#fef2f2"}}>
                        <td style={{padding:"4px 8px",fontWeight:700}}>{d.nom}</td>
                        <td style={{padding:"4px 8px",textAlign:"center"}}>{d.classe}</td>
                        <td style={{padding:"4px 8px",textAlign:"center",fontWeight:800,
                          color:d.moy===null?"#9ca3af":d.statut==="promu"?"#15803d":"#b91c1c"}}>
                          {d.moy===null?"—":d.moy.toFixed(2)}
                        </td>
                        <td style={{padding:"4px 8px",textAlign:"center"}}>
                          <span style={{padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700,
                            background:d.statut==="promu"?"#dcfce7":"#fee2e2",
                            color:d.statut==="promu"?"#15803d":"#b91c1c"}}>
                            {d.statut==="promu"?"OK Promu":"🔁 Redoublant"}
                          </span>
                        </td>
                        <td style={{padding:"4px 8px",textAlign:"center",color:"#6b7280"}}>
                          {d.nouvClasse||"—"}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>}
            </>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="amber" onClick={()=>setPromoModal(true)} disabled={promoEn}>
                {promoEn?"⏳ En cours...":"Promotion Lancer la promotion"}
              </Btn>
              {promoRes&&<Btn v="ghost" onClick={()=>setPromoRes(null)}>Effacer le résultat</Btn>}
            </div>
          </div>
        </div>
      </Card>

      {/* Modal config promotion */}
      {promoModal&&<Modale titre="⚙️ Configuration de la promotion" fermer={()=>setPromoModal(false)}>
        <p style={{margin:"0 0 16px",fontSize:13,color:"#374151"}}>
          Définissez le seuil de passage pour chaque section. Les élèves dont la moyenne annuelle est inférieure au seuil redoublent.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>
              Seuil College / Lycee (sur 20)
            </label>
            <input type="number" min={0} max={20} step={0.5} value={seuilCollege}
              onChange={e=>setSeuilCollege(e.target.value)}
              style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
            <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Defaut recommande : 10/20</p>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>
              Seuil Primaire (sur 10)
            </label>
            <input type="number" min={0} max={10} step={0.5} value={seuilPrimaire}
              onChange={e=>setSeuilPrimaire(e.target.value)}
              style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
            <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Defaut recommande : 5/10</p>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:6}}>
            Élèves sans notes (aucun devoir saisi)
          </label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["promouvoir","OK Promouvoir automatiquement"],["redoubler","🔁 Faire redoubler automatiquement"]].map(([v,lbl])=>(
              <label key={v} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
                <input type="radio" name="sansNotes" value={v}
                  checked={sansNotesBehavior===v} onChange={()=>setSansNotesBehavior(v)}/>
                {lbl}
              </label>
            ))}
          </div>
        </div>
        <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
          Attention : cette action est <strong>irréversible</strong>. Les classes de tous les élèves promus seront immédiatement mises à jour dans Firestore.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={()=>setPromoModal(false)}>Annuler</Btn>
          <Btn v="amber" onClick={lancerPromotion}>Promotion Confirmer et lancer</Btn>
        </div>
      </Modale>}

      <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.blueDark}}>
        <strong>🔐 Rôle Administrateur :</strong> Vous pouvez modifier les mots de passe de tous les utilisateurs. Vous avez accès en lecture seule à tous les modules.
        {!peutGererRoles && <div style={{marginTop:6,fontSize:12,color:"#6b7280"}}>La configuration des rôles et l'accès Fondation sont réservés à la Direction Générale.</div>}
      </div>

      {peutGererRoles && <Card style={{marginBottom:20,padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <div>
            <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Organisation des comptes par école</p>
            <p style={{margin:0,fontSize:12,color:"#6b7280"}}>Vous personnalisez ici les intitulés, identifiants et modules visibles des comptes système. Les rôles techniques restent fixes pour la sécurité.</p>
          </div>
          <Btn onClick={sauvegarderRoles} disabled={savingRoles}>{savingRoles?"Enregistrement...":"Enregistrer la configuration"}</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {ROLE_IDS_PERSONNALISABLES.map((role) => {
            const config = roleConfigForm[role] || {};
            const modulesOptions = getModuleOptionsForRole(role);
            return (
              <div key={role} style={{border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px",background:"#f8fafc"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Badge color={compteColor(role)}>{config.label || role}</Badge>
                    <span style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>role: {role}</span>
                  </div>
                  <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:config.active!==false?C.greenDk:"#9ca3af",cursor:role==="direction"?"default":"pointer"}}>
                    <input type="checkbox" checked={config.active!==false} disabled={role==="direction"} onChange={(event)=>majRoleConfig(role,"active",event.target.checked)} />
                    {role==="direction"?"Toujours actif":"Compte actif"}
                  </label>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Label affiché</label>
                    <input value={config.label||""} onChange={(event)=>majRoleConfig(role,"label",event.target.value)} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box"}} />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Nom du compte</label>
                    <input value={config.nom||""} onChange={(event)=>majRoleConfig(role,"nom",event.target.value)} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box"}} />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blueDark,marginBottom:4}}>Identifiant</label>
                    <input value={config.login||""} onChange={(event)=>majRoleConfig(role,"login",normalizeRoleLogin(event.target.value, role))} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,boxSizing:"border-box",fontFamily:"monospace"}} />
                  </div>
                </div>
                <div style={{marginTop:12}}>
                  <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:C.blueDark}}>Modules visibles</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {modulesOptions.map((moduleOption) => (
                      <label key={moduleOption.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,border:"1px solid #dbe4ee",background:"#fff",fontSize:12,color:C.blueDark,cursor:"pointer"}}>
                        <input type="checkbox" checked={(config.modules||[]).includes(moduleOption.id)} onChange={()=>toggleModuleRole(role,moduleOption.id)} />
                        <span>{moduleOption.label}</span>
                      </label>
                    ))}
                  </div>
                  {ACCES[role]?.includes("admin_panel") && (
                    <p style={{margin:"8px 0 0",fontSize:11,color:"#9ca3af"}}>Les accès sensibles indispensables sont conservés automatiquement pour ce rôle.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>}

      {/* Modale mots de passe initiaux — affichée une seule fois */}
      {mdpsInitiaux&&<Modale titre="🔐 Comptes créés — Notez les mots de passe" fermer={null}>
        <p style={{fontSize:13,color:"#b91c1c",fontWeight:700,marginBottom:12}}>
          ⚠️ Ces mots de passe ne seront plus jamais affichés. Notez-les maintenant.
        </p>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
          <THead cols={["Login","Rôle","Mot de passe temporaire"]}/>
          <tbody>{mdpsInitiaux.map((compte)=>(
            <TR key={`${compte.role}-${compte.login}`}>
              <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{compte.login}</span></TD>
              <TD><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={compteColor(compte.role)}>{compte.label}</Badge></div></TD>
              <TD><span style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:C.blueDark,letterSpacing:"0.05em"}}>{compte.mdp}</span></TD>
            </TR>
          ))}</tbody>
        </table>
        <Btn v="success" onClick={()=>setMdpsInitiaux(null)}>✅ J'ai noté tous les mots de passe</Btn>
      </Modale>}

      {chargement||initEnCours ? <Chargement/> : (
        <Card>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
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
          </table>
        </Card>
      )}

      {/* ── CONTRÔLE DES MODIFICATIONS ── */}
      <Card style={{marginTop:20,padding:"20px 24px"}}>
        <p style={{margin:"0 0 6px",fontWeight:800,fontSize:14,color:C.blueDark}}>🔒 Autorisation de modification</p>
        <p style={{margin:"0 0 18px",fontSize:12,color:"#6b7280"}}>Chaque rôle peut toujours <strong>creer</strong> des enregistrements. Une fois sauvegardes, ils sont verrouilles. Activez le verrou pour permettre les corrections.</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {cle:"comptable", label:"Comptable",   desc:"Finances, salaires, mensualites", icon:"💰", color:"#0e7490"},
            {cle:"primaire",  label:"Primaire",     desc:"Classes, élèves, bulletins, notes", icon:"🌱", color:C.greenDk},
            {cle:"secondaire",label:"Secondaire",   desc:"College, lycee, enseignants, EDT", icon:"🏫", color:C.blue},
          ].map(({cle,label,desc,icon,color})=>{
            const actif = !!verrous[cle];
            const enCours = savingVerrou === cle;
            return (
              <div key={cle} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",
                borderRadius:10,border:`2px solid ${actif?color:"#e5e7eb"}`,
                background:actif?`${color}0d`:"#f9fafb",transition:"all 0.2s"}}>
                <span style={{fontSize:22}}>{icon}</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:800,color:C.blueDark}}>{label}</p>
                  <p style={{margin:0,fontSize:11,color:"#6b7280"}}>{desc}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:actif?color:"#9ca3af"}}>
                    {actif?"OK Modification activee":"🔒 Lecture seule"}
                  </span>
                  <button onClick={()=>!enCours&&toggleVerrou(cle)} disabled={enCours}
                    style={{
                      position:"relative",width:52,height:28,borderRadius:14,border:"none",cursor:"pointer",
                      background:actif?color:"#d1d5db",transition:"background 0.2s",padding:0,
                    }}>
                    <span style={{
                      position:"absolute",top:3,left:actif?26:3,width:22,height:22,
                      borderRadius:"50%",background:"#fff",transition:"left 0.2s",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.25)",display:"block",
                    }}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{margin:"14px 0 0",fontSize:11,color:"#9ca3af"}}>
          💡 Les modifications sont effectives immédiatement pour tous les utilisateurs connectés.
        </p>
      </Card>

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






