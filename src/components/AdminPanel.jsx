import React, { useState, useEffect, useContext } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { getAuthHeaders } from "../apiClient";
import { db } from "../firebaseDb";
import { C, COMPTES_DEFAUT, TOUTES_ANNEES, genererMdp } from "../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Stat, TD, THead, TR } from "./ui";

// ══════════════════════════════════════════════════════════════
//  PANNEAU ADMIN — Gestion des mots de passe
// ══════════════════════════════════════════════════════════════
// Mapping promotion classes : quelle classe vient après quelle classe
const PROMOTION_SUIVANTE = {
  // Primaire (classique)
  "Maternelle A":"1ère Année A","Maternelle B":"1ère Année B",
  "1ère Année A":"2ème Année A","1ère Année B":"2ème Année B",
  "2ème Année A":"3ème Année A","2ème Année B":"3ème Année B",
  "3ème Année A":"4ème Année A","3ème Année B":"4ème Année B",
  "4ème Année A":"5ème Année A","4ème Année B":"5ème Année B",
  "5ème Année A":"6ème Année A","5ème Année B":"6ème Année B",
  // Collège
  "6ème A":"5ème A","6ème B":"5ème B","6ème C":"5ème C",
  "5ème A":"4ème A","5ème B":"4ème B","5ème C":"4ème C",
  "4ème A":"3ème A","4ème B":"3ème B","4ème C":"3ème C",
  // Lycée
  "Seconde A":"Première A","Seconde B":"Première B","Seconde C":"Première C",
  "Première A":"Terminale A","Première B":"Terminale B","Première C":"Terminale C",
};

function AdminPanel({annee, setAnnee, verrous={}, schoolId}) {
  const {toast, schoolInfo} = useContext(SchoolContext);
  const {items:comptes, chargement} = useFirestore("comptes");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [savingVerrou, setSavingVerrou] = useState(null);
  const [mdpsInitiaux, setMdpsInitiaux] = useState(null);
  const [initEnCours, setInitEnCours] = useState(false);
  const [promoEn, setPromoEn] = useState(false);
  const [promoRes, setPromoRes] = useState(null);
  const [promoModal, setPromoModal] = useState(false);
  const [seuilCollege, setSeuilCollege] = useState(10);
  const [seuilPrimaire, setSeuilPrimaire] = useState(5);
  const [sansNotesBehavior, setSansNotesBehavior] = useState("promouvoir"); // "promouvoir" | "redoubler"
  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));

  // Calcule la moyenne annuelle d'un élève à partir de ses notes (toutes périodes)
  const calcMoyenneAnnuelle = (notes) => {
    if(!notes || notes.length===0) return null;
    const sum = notes.reduce((s,n)=>s+Number(n.note||0),0);
    return sum / notes.length; // moyenne simple sur toutes les notes T1+T2+T3
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
      const details = []; // pour affichage résultats
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
          // Notes de cet élève
          const notesEleve = notesToutes.filter(n=>n.eleveId===d.id);
          const moy = calcMoyenneAnnuelle(notesEleve);
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
      toast(`Promotion terminée — ${promus} promus, ${redoublants} redoublants`, "success");
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

  // Initialiser les comptes avec mots de passe aléatoires si collection vide
  useEffect(() => {
    if (chargement || initEnCours) return;
    const comptesManquants = COMPTES_DEFAUT.filter((compteDefaut) =>
      !comptes.some((compteExistant) => compteExistant.role === compteDefaut.role),
    );
    if (comptesManquants.length === 0) return;
    setInitEnCours(true);
    (async () => {
      const mdps = {};
      for (const c of comptesManquants) {
        const mdpClair = genererMdp();
        mdps[c.login] = mdpClair;
        try {
          const headers = await getAuthHeaders({"Content-Type":"application/json"});
          const res = await fetch("/api/account-manage", {
            method:"POST", headers,
            body:JSON.stringify({
              action:"create",
              schoolId,
              login:c.login,
              mdp:mdpClair,
              role:c.role,
              nom:c.nom,
              label:c.label,
              statut:"Actif",
            }),
          });
          const data = await res.json().catch(()=>({}));
          if(!res.ok||!data.ok) throw new Error(data.error||`Création du compte ${c.login} impossible.`);
        } catch (e) {
          toast(e.message||"Erreur création comptes.", "error");
          setInitEnCours(false);
          return;
        }
      }
      if (Object.keys(mdps).length > 0) setMdpsInitiaux(mdps);
      setInitEnCours(false);
    })();
  }, [chargement, comptes, initEnCours, schoolId, toast]);

  const sauvegarder = async () => {
    if(!form.mdp || form.mdp.length < 8){
      toast("Le mot de passe doit contenir au moins 8 caractères.", "warning");
      return;
    }
    try{
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await fetch("/api/account-manage", {
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
        <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année Scolaire</p>
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
        <p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>⚠️ Changer l'année affecte tous les modules de l'application.</p>
      </Card>

      {/* ── PROMOTION FIN D'ANNÉE ── */}
      <Card style={{marginBottom:20,padding:"16px 20px",border:"2px solid #fef3c7"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <span style={{fontSize:28}}>🎓</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Promotion de fin d'année</p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
              Avance les élèves dont la moyenne annuelle atteint le seuil de passage. Les autres redoublent.
            </p>
            {promoRes&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
                <div style={{background:"#dcfce7",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>{promoRes.promus}</div>
                  <div style={{fontSize:11,color:"#15803d"}}>✅ Promus</div>
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
                      <th style={{padding:"5px 8px",textAlign:"left"}}>Élève</th>
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
                            {d.statut==="promu"?"✅ Promu":"🔁 Redoublant"}
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
                {promoEn?"⏳ En cours...":"🎓 Lancer la promotion"}
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
              Seuil Collège / Lycée (sur 20)
            </label>
            <input type="number" min={0} max={20} step={0.5} value={seuilCollege}
              onChange={e=>setSeuilCollege(e.target.value)}
              style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
            <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Défaut recommandé : 10/20</p>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>
              Seuil Primaire (sur 10)
            </label>
            <input type="number" min={0} max={10} step={0.5} value={seuilPrimaire}
              onChange={e=>setSeuilPrimaire(e.target.value)}
              style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
            <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Défaut recommandé : 5/10</p>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:6}}>
            Élèves sans notes (aucun devoir saisi)
          </label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["promouvoir","✅ Promouvoir automatiquement"],["redoubler","🔁 Faire redoubler automatiquement"]].map(([v,lbl])=>(
              <label key={v} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
                <input type="radio" name="sansNotes" value={v}
                  checked={sansNotesBehavior===v} onChange={()=>setSansNotesBehavior(v)}/>
                {lbl}
              </label>
            ))}
          </div>
        </div>
        <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
          ⚠️ Cette action est <strong>irréversible</strong>. Les classes de tous les élèves promus seront immédiatement mises à jour dans Firestore.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={()=>setPromoModal(false)}>Annuler</Btn>
          <Btn v="amber" onClick={lancerPromotion}>🎓 Confirmer et lancer</Btn>
        </div>
      </Modale>}

      <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.blueDark}}>
        <strong>🔐 Rôle Administrateur :</strong> Vous pouvez modifier les mots de passe de tous les utilisateurs. Vous avez accès en lecture seule à tous les modules.
      </div>

      {/* Modale mots de passe initiaux — affichée une seule fois */}
      {mdpsInitiaux&&<Modale titre="🔐 Comptes créés — Notez les mots de passe" fermer={null}>
        <p style={{fontSize:13,color:"#b91c1c",fontWeight:700,marginBottom:12}}>
          ⚠️ Ces mots de passe ne seront plus jamais affichés. Notez-les maintenant.
        </p>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
          <THead cols={["Login","Rôle","Mot de passe temporaire"]}/>
          <tbody>{COMPTES_DEFAUT.filter(c=>mdpsInitiaux[c.login]).map(c=>(
            <TR key={c.login}>
              <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{c.login}</span></TD>
              <TD><Badge color={c.role==="admin"?"purple":c.role==="comptable"?"teal":c.role==="direction"?"blue":"vert"}>{c.label}</Badge></TD>
              <TD><span style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:C.blueDark,letterSpacing:"0.05em"}}>{mdpsInitiaux[c.login]}</span></TD>
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
              {comptes.map((c,i)=>(
                <TR key={c._id||i}>
                  <TD bold>{c.nom}</TD>
                  <TD><span style={{fontFamily:"monospace",background:"#e0ebf8",padding:"2px 8px",borderRadius:4,fontSize:12,color:C.blue}}>{c.login}</span></TD>
                  <TD><Badge color={c.role==="admin"?"purple":c.role==="comptable"?"teal":c.role==="direction"?"blue":"vert"}>{c.label}</Badge></TD>
                  <TD>
                    <Badge color="vert">🔒 Sécurisé</Badge>
                  </TD>
                  <TD>
                    {c._id && (
                      <Btn sm onClick={()=>{setForm({...c,mdp:""});setModal("mdp");}}>✏️ Modifier</Btn>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── CONTRÔLE DES MODIFICATIONS ── */}
      <Card style={{marginTop:20,padding:"20px 24px"}}>
        <p style={{margin:"0 0 6px",fontWeight:800,fontSize:14,color:C.blueDark}}>🔒 Autorisation de modification</p>
        <p style={{margin:"0 0 18px",fontSize:12,color:"#6b7280"}}>Chaque rôle peut toujours <strong>créer</strong> des enregistrements. Une fois sauvegardés, ils sont verrouillés. Activez le verrou pour permettre les corrections.</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {cle:"comptable", label:"Comptable",   desc:"Finances, salaires, mensualités", icon:"💰", color:"#0e7490"},
            {cle:"primaire",  label:"Primaire",     desc:"Classes, élèves, bulletins, notes", icon:"🌱", color:C.greenDk},
            {cle:"secondaire",label:"Secondaire",   desc:"Collège, lycée, enseignants, EDT", icon:"🏫", color:C.blue},
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
                    {actif?"✅ Modification activée":"🔒 Lecture seule"}
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
              ⚠️ Communiquez ce mot de passe directement à l'utilisateur concerné.
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
