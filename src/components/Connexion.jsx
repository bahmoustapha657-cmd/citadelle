import React, { useState, useEffect, useContext } from "react";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomTokenClient } from "../firebaseAuth";
import { db } from "../firebaseDb";
import { SchoolContext } from "../contexts/SchoolContext";
import { C, getAnnee } from "../constants";
import Logo from "../Logo";
import { Chargement } from "./ui";

// ══════════════════════════════════════════════════════════════
//  ÉCRAN DE CONNEXION
// ══════════════════════════════════════════════════════════════
function Connexion({onLogin, onInscription}) {
  useContext(SchoolContext);
  const [codeEcole,setCodeEcole]=useState(()=>localStorage.getItem("LC_schoolId")||"");
  const [login,setLogin]=useState("");
  const [mdp,setMdp]=useState("");
  const [erreur,setErreur]=useState("");
  const [voir,setVoir]=useState(false);
  const [chargement,setChargement]=useState(false);
  const [infoEcole,setInfoEcole]=useState(null); // infos chargées après saisie du code école

  // Charger les infos de l'école dès que le code est saisi
  useEffect(()=>{
    const sid=codeEcole.trim().toLowerCase();
    if(!sid||sid==="superadmin"){setInfoEcole(null);return;}
    const t=setTimeout(()=>{
      getDoc(doc(db,"ecoles_public",sid)).then(snap=>{
        if(snap.exists()){setInfoEcole(snap.data());return;}
        return getDoc(doc(db,"ecoles",sid)).then(fallback=>{
          setInfoEcole(fallback.exists()?fallback.data():null);
        });
      }).catch(()=>setInfoEcole(null));
    },600); // debounce 600ms
    return ()=>clearTimeout(t);
  },[codeEcole]);

  const connecter=async()=>{
    const sid=codeEcole.trim().toLowerCase();
    if(!sid){setErreur("Veuillez entrer le code de votre école.");return;}
    if(!login.trim()){setErreur("Veuillez entrer votre identifiant.");return;}
    setChargement(true);setErreur("");
    try{
      // ── Mode Super-Admin (vérification côté serveur) ──
      if(sid==="superadmin"){
        const r=await fetch("/api/superadmin-login",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({login:login.trim(),mdp}),
        });
        const data=await r.json().catch(()=>({}));
        if(!r.ok||!data.ok){setErreur(data.error||"Identifiants super-admin incorrects.");return;}
        // Connexion immédiate — ne pas attendre onAuthStateChanged qui peut échouer
        // si le profil /users/{uid} n'existe pas encore en Firestore
        onLogin(data.compte,"superadmin");
        // Firebase Auth en arrière-plan pour la persistance de session (best-effort)
        if(data.customToken){
          signInWithCustomTokenClient(data.customToken).catch(()=>{});
        }
        return;
      }

      // ── Mode École — toujours via API serveur (Firestore = source de vérité) ──
      // Ne pas utiliser signInWithEmailAndPassword directement : Firebase Auth peut
      // conserver un ancien mot de passe si le compte a été modifié dans Firestore.
      const r=await fetch("/api/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({login:login.trim().toLowerCase(), mdp, schoolId:sid}),
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.ok){setErreur(data.error||"Identifiant ou mot de passe incorrect.");return;}

      // 3. Connecter via custom token Firebase
      try{
        await signInWithCustomTokenClient(data.customToken);
        // onAuthStateChanged prend le relais
      }catch{
        // Dernier recours : connexion locale temporaire
        onLogin(data.compte, sid);
      }
    }catch{
      setErreur("Impossible de joindre le serveur. Vérifiez le code école.");
    }finally{
      setChargement(false);
    }
  };

  const inp2 = {
    width:"100%",border:"2px solid #e5e9f0",borderRadius:9,
    padding:"11px 14px",fontSize:14,boxSizing:"border-box",outline:"none",
    fontFamily:"inherit",transition:"border-color .15s",
  };

  return (
    <div style={{
      minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#0A1628",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"24px 16px",
    }}>
      {/* Carte centrale */}
      <div style={{
        background:"#fff",borderRadius:20,width:"100%",maxWidth:480,
        boxShadow:"0 32px 80px rgba(0,0,0,0.55)",overflow:"hidden",
      }}>
        {/* En-tête colorée */}
        <div style={{
          background:`linear-gradient(135deg,${C.blueDark} 0%,${C.blue} 100%)`,
          padding:"32px 36px 28px",textAlign:"center",
        }}>
          {/* Logo — variant dark pour que "Edu" soit visible sur fond sombre */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
            <Logo width={220} height={70} variant="light"/>
          </div>
          <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.55)",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:600}}>
            Gestion scolaire intelligente
          </p>

          {/* Infos école si code reconnu */}
          {infoEcole&&(
            <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
              {infoEcole.logo&&<img src={infoEcole.logo} alt="" style={{width:36,height:36,objectFit:"contain",borderRadius:6,flexShrink:0}}/>}
              <div style={{textAlign:"left"}}>
                <p style={{margin:0,fontSize:14,fontWeight:800,color:infoEcole.couleur2||C.green}}>{infoEcole.nom}</p>
                <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.45)"}}>{infoEcole.ville}, {infoEcole.pays} · {getAnnee()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Formulaire */}
        <div style={{padding:"30px 36px 32px",display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Code école</label>
            <input value={codeEcole} onChange={e=>setCodeEcole(e.target.value)}
              placeholder="Ex. : ecole-la-citadelle"
              onKeyDown={e=>e.key==="Enter"&&connecter()}
              style={inp2}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Identifiant</label>
            <input value={login} onChange={e=>setLogin(e.target.value)}
              placeholder="Votre identifiant"
              onKeyDown={e=>e.key==="Enter"&&connecter()}
              style={inp2}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Mot de passe</label>
            <div style={{position:"relative"}}>
              <input value={mdp} onChange={e=>setMdp(e.target.value)}
                type={voir?"text":"password"} placeholder="••••••••"
                onKeyDown={e=>e.key==="Enter"&&connecter()}
                style={{...inp2,paddingRight:44}}/>
              <button onClick={()=>setVoir(v=>!v)}
                style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:17,lineHeight:1}}>
                {voir?"🙈":"👁️"}
              </button>
            </div>
          </div>

          {erreur&&(
            <div style={{background:"#fce8e8",border:"1px solid #f5c1c1",borderRadius:9,padding:"10px 14px",fontSize:13,color:"#9b2020",textAlign:"center",fontWeight:600}}>
              {erreur}
            </div>
          )}

          <button onClick={connecter} disabled={chargement}
            style={{width:"100%",background:`linear-gradient(90deg,${C.blue},${C.green})`,
              color:"#fff",border:"none",padding:"13px",borderRadius:10,
              fontSize:15,fontWeight:800,cursor:chargement?"not-allowed":"pointer",
              marginTop:4,opacity:chargement?0.7:1,letterSpacing:"0.02em"}}>
            {chargement?"Connexion en cours…":"Se connecter →"}
          </button>

          <p style={{textAlign:"center",margin:"4px 0 0",color:"#9ca3af",fontSize:12}}>
            Pas encore inscrit ?{" "}
            <button
              type="button"
              onClick={()=>onInscription&&onInscription()}
              style={{background:"none",border:"none",padding:0,color:C.blue,cursor:"pointer",fontWeight:700,fontSize:"inherit",fontFamily:"inherit"}}
            >
              Créer un compte école
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════

export { Connexion };
