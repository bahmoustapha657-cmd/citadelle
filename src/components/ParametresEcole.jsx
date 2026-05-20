import React, { useContext, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { C, setMonnaie } from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { db } from "../firebaseDb";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { getEvaluationFormsConfig } from "../evaluation-forms";
import { AffichageSettings } from "./AffichageSettings";
import { MatriculeSettings } from "./MatriculeSettings";
import { MigrationPeriodesModal } from "./MigrationPeriodesModal";
import { IdentiteTab } from "./parametres/IdentiteTab";
import { EvaluationsTab } from "./parametres/EvaluationsTab";
import { AccueilTab } from "./parametres/AccueilTab";
import { OfficielTab } from "./parametres/OfficielTab";
import { DangerTab } from "./parametres/DangerTab";
import { MonnaieComptableView } from "./parametres/MonnaieComptableView";

// Orchestrateur de l'écran "Paramètres de l'école".
// Centralise l'état partagé (form, accueil, evaluationForms, danger…),
// la logique de sauvegarde, et la navigation entre onglets.
// Chaque onglet vit dans src/components/parametres/*Tab.jsx — voir aussi
// MatriculeSettings.jsx et AffichageSettings.jsx (extraits avant le
// refactor de découpage de mai 2026).
function ParametresEcole({ utilisateurRole = "", onSchoolClosed = null, initialTab = null, onTabConsumed = null }) {
  const {schoolId,schoolInfo,setSchoolInfo,toast} = useContext(SchoolContext);
  const {items:honneurs, ajouter:ajHonneur, modifier:modHonneur, supprimer:supHonneur} = useFirestore("honneurs");
  const [tabParam, setTabParam] = useState(initialTab || "identite");
  // Si App nous transmet un onglet initial (deep-link depuis dashboard),
  // on l'applique au mount puis on demande à App de le réinitialiser
  // pour ne pas re-écraser le choix de l'utilisateur lors d'un retour.
  useEffect(() => {
    if (initialTab) {
      setTabParam(initialTab);
      if (typeof onTabConsumed === "function") onTabConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [form,setForm] = useState({
    nom: schoolInfo.nom||"",
    type: schoolInfo.type||"Groupe Scolaire Privé",
    ville: schoolInfo.ville||"",
    pays: schoolInfo.pays||"République de Guinée",
    couleur1: schoolInfo.couleur1||"#0A1628",
    couleur2: schoolInfo.couleur2||"#00C48C",
    logo: schoolInfo.logo||"",
    devise: schoolInfo.devise||"",
    monnaie: schoolInfo.monnaie||"GNF",
    ministere: schoolInfo.ministere||"",
    ire: schoolInfo.ire||"",
    dpe: schoolInfo.dpe||"",
    agrement: schoolInfo.agrement||"",
    moisDebut: schoolInfo.moisDebut||"Octobre",
    periodicite: schoolInfo.periodicite||"trimestre",
    // Périodicité par section : permet "Primaire trimestre / Secondaire semestre".
    // Fallback sur le champ legacy `periodicite` pour rétrocompat.
    periodicitePrimaire: schoolInfo.periodicitePrimaire||schoolInfo.periodicite||"trimestre",
    periodiciteSecondaire: schoolInfo.periodiciteSecondaire||schoolInfo.periodicite||"trimestre",
  });
  const acc0 = schoolInfo.accueil||{};
  const [accueil, setAccueil] = useState({
    active: acc0.active||false,
    slogan: acc0.slogan||"",
    texteAccueil: acc0.texteAccueil||"",
    bannerUrl: acc0.bannerUrl||"",
    photos: acc0.photos||[],
    showAnnonces: acc0.showAnnonces!==false,
    showHonneurs: acc0.showHonneurs!==false,
    showContact: acc0.showContact!==false,
    telephone: acc0.telephone||"",
    email: acc0.email||"",
    facebook: acc0.facebook||"",
    whatsapp: acc0.whatsapp||"",
    adresse: acc0.adresse||"",
  });
  const [formHonneur, setFormHonneur] = useState({});
  const [modalH, setModalH] = useState(null);
  const [evaluationForms, setEvaluationForms] = useState(() => getEvaluationFormsConfig(schoolInfo));
  const chgA = k => e => setAccueil(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));
  const [chargement,setChargement] = useState(false);
  const [msgSucces,setMsgSucces] = useState("");
  const [erreur,setErreur] = useState("");
  const [migrationOuverte, setMigrationOuverte] = useState(false);
  const [apercu,setApercu] = useState(null); // aperçu logo uploadé

  const [dangerAction,setDangerAction] = useState("");
  const [dangerConfirmation,setDangerConfirmation] = useState("");
  const [dangerLoading,setDangerLoading] = useState(false);

  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const setEvaluationLabel = (groupId, formId, label) => {
    setEvaluationForms((prev) => ({
      ...prev,
      [groupId]: prev[groupId].map((item) => (
        item.id === formId ? { ...item, label } : item
      )),
    }));
  };
  const toggleEvaluationActive = (groupId, formId) => {
    setEvaluationForms((prev) => ({
      ...prev,
      [groupId]: prev[groupId].map((item) => (
        item.id === formId ? { ...item, active: !item.active } : item
      )),
    }));
  };

  const [couleursDetectees, setCouleursDetectees] = useState(null);
  const canManageLifecycle = schoolId && schoolId !== "superadmin" && ["direction","superadmin"].includes(utilisateurRole);
  // Profil légal : direction/admin/superadmin (cf. règle Firestore).
  const peutEditerLegal = ["direction","admin","superadmin"].includes(utilisateurRole);
  // Le comptable n'a accès qu'au sélecteur de monnaie (rules Firestore autorisent
  // uniquement update de `monnaie` pour ce rôle — cf. firestore.rules §/ecoles).
  const isComptableSeul = utilisateurRole === "comptable";
  const dangerConfig = {
    deactivate: {
      title: "Desactiver l'ecole",
      confirmation: "DESACTIVER",
      tone: "#b45309",
      bg: "#fff7ed",
      border: "#fdba74",
      button: "#f59e0b",
      description: "L'acces sera bloque pour tous les comptes de cette ecole jusqu'a reactivation.",
    },
    delete: {
      title: "Supprimer l'ecole",
      confirmation: "SUPPRIMER",
      tone: "#b91c1c",
      bg: "#fef2f2",
      border: "#fca5a5",
      button: "#dc2626",
      description: "Suppression logique uniquement : les donnees sont preservees, mais l'ecole disparait de l'acces normal.",
    },
  };

  // Extrait les 2 couleurs dominantes d'une image via Canvas
  const extraireCouleurs = (src, cb) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 80; // résolution réduite pour perf
        const canvas = document.createElement("canvas");
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        const freq = {};
        for(let i=0;i<px.length;i+=4){
          const [r,g,b,a] = [px[i],px[i+1],px[i+2],px[i+3]];
          if(a<100) continue;                        // transparent
          if(r>230&&g>230&&b>230) continue;          // blanc
          if(r<25&&g<25&&b<25) continue;             // noir
          // Quantiser (grouper les teintes proches)
          const k=`${Math.round(r/28)*28},${Math.round(g/28)*28},${Math.round(b/28)*28}`;
          freq[k]=(freq[k]||0)+1;
        }
        const tri = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
        if(!tri.length){cb(null,null);return;}
        const hex=([r,g,b])=>"#"+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,"0")).join("");
        const c1rgb = tri[0][0].split(",").map(Number);
        const c1 = hex(c1rgb);
        let c2=null;
        for(const [k] of tri.slice(1)){
          const rgb=k.split(",").map(Number);
          const d=Math.sqrt(c1rgb.reduce((s,v,i)=>s+(v-rgb[i])**2,0));
          if(d>70){c2=hex(rgb);break;}
        }
        cb(c1, c2||"#00C48C");
      } catch{ cb(null,null); }
    };
    img.onerror=()=>cb(null,null);
    img.src=src;
  };

  // Upload logo fichier → base64 + extraction couleurs
  const handleLogoFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){ setErreur("Logo trop grand (max 500 Ko)."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      setForm(p=>({...p,logo:src}));
      setApercu(src);
      setCouleursDetectees(null);
      extraireCouleurs(src, (c1, c2) => {
        if(c1) setCouleursDetectees({c1, c2});
      });
    };
    reader.readAsDataURL(file);
  };

  const appliquerCouleursDetectees = () => {
    if(!couleursDetectees) return;
    setForm(p=>({...p, couleur1:couleursDetectees.c1, couleur2:couleursDetectees.c2}));
    setCouleursDetectees(null);
  };

  const sauvegarder = async () => {
    if(isComptableSeul) {
      setChargement(true); setErreur("");
      try {
        const monnaie = (form.monnaie||"GNF").trim().toUpperCase();
        await updateDoc(doc(db,"ecoles",schoolId), { monnaie });
        setSchoolInfo(prev=>({...prev,monnaie}));
        setMonnaie(monnaie);
        setMsgSucces("Monnaie enregistrée.");
        setTimeout(()=>setMsgSucces(""),3000);
      } catch(e) {
        setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
      } finally {
        setChargement(false);
      }
      return;
    }
    if(!form.nom.trim()){setErreur("Le nom de l'école est requis.");return;}
    setChargement(true); setErreur("");
    try {
      const data = {
        nom: form.nom.trim(),
        type: form.type.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        couleur1: form.couleur1,
        couleur2: form.couleur2,
        logo: form.logo||null,
        devise: form.devise.trim(),
        monnaie: (form.monnaie||"GNF").trim().toUpperCase(),
        // ministere / ire / dpe / agrement : MIGRÉS vers /ecoles/{schoolId}/config/legal
        // (édités via le widget Conformité). Plus écrits par ce formulaire.
        // Les valeurs Firestore existantes restent en place (updateDoc merge),
        // utilisées par resolveLegalFields() comme fallback tant que le profil
        // légal structuré n'est pas complet.
        moisDebut: form.moisDebut,
        periodicite: form.periodicite || "trimestre",
        periodicitePrimaire: form.periodicitePrimaire || "trimestre",
        periodiciteSecondaire: form.periodiciteSecondaire || "trimestre",
        evaluationForms,
        accueil: {
          active: accueil.active,
          slogan: accueil.slogan.trim(),
          texteAccueil: accueil.texteAccueil.trim(),
          bannerUrl: accueil.bannerUrl.trim(),
          photos: accueil.photos,
          showAnnonces: accueil.showAnnonces,
          showHonneurs: accueil.showHonneurs,
          showContact: accueil.showContact,
          telephone: accueil.telephone.trim(),
          email: accueil.email.trim(),
          facebook: accueil.facebook.trim(),
          whatsapp: accueil.whatsapp.trim(),
          adresse: accueil.adresse.trim(),
        },
      };
      await updateDoc(doc(db,"ecoles",schoolId), data);
      setSchoolInfo(prev=>({...prev,...data}));
      setMonnaie(data.monnaie);
      try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        await apiFetch("/ecole-public-sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync", schoolId }),
        });
      } catch { /* non-bloquant : la source privée est à jour */ }
      if(data.couleur1) document.documentElement.style.setProperty("--sc1", data.couleur1);
      if(data.couleur2) document.documentElement.style.setProperty("--sc2", data.couleur2);
      setMsgSucces("Paramètres enregistrés avec succès.");
      setTimeout(()=>setMsgSucces(""),4000);
    } catch(e) {
      setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
    } finally {
      setChargement(false);
    }
  };

  const lancerActionEcole = async () => {
    if (!canManageLifecycle || !dangerAction || !dangerConfig[dangerAction]) return;
    setDangerLoading(true);
    setErreur("");
    setMsgSucces("");
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const response = await apiFetch("/school-lifecycle", {
        method: "POST",
        headers,
        body: JSON.stringify({
          schoolId,
          action: dangerAction,
          confirmation: dangerConfirmation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setErreur(data.error || "Action impossible pour le moment.");
        return;
      }

      const nextInfo = {
        ...schoolInfo,
        actif: data.actif,
        supprime: data.supprime,
      };
      setSchoolInfo(nextInfo);
      setDangerAction("");
      setDangerConfirmation("");

      if (dangerAction === "delete") {
        toast("Ecole supprimee.", "success");
      } else {
        toast("Ecole desactivee.", "success");
      }

      localStorage.removeItem("LC_schoolId");
      if (typeof onSchoolClosed === "function") {
        onSchoolClosed();
      }
    } catch {
      setErreur("Erreur lors de la mise a jour de l'ecole.");
    } finally {
      setDangerLoading(false);
    }
  };

  // Upload photo galerie → base64
  const handlePhotoGalerie = e => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if(file.size > 800*1024){ toast(`${file.name} trop grande (max 800 Ko).`,"warning"); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setAccueil(p=>({...p, photos:[...(p.photos||[]), {url:ev.target.result, caption:""}]}));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Upload bannière → base64
  const handleBanniere = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 1024*1024){ setErreur("Bannière trop grande (max 1 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = ev => setAccueil(p=>({...p, bannerUrl:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetLogo = () => { setForm(p=>({...p,logo:""})); setApercu(null); };

  const inp = {
    width:"100%",border:"1px solid #d1d5db",borderRadius:8,
    padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",
  };
  const lbl = {
    display:"block",fontSize:11,fontWeight:700,color:C.blueDark,
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4,marginTop:14,
  };
  const sec = {
    background:"#fff",borderRadius:14,padding:"24px 28px",
    boxShadow:"0 2px 16px rgba(0,32,80,0.07)",marginBottom:20,
  };
  const tabItems = [
    {id:"identite", label:"Identite"},
    {id:"accueil", label:"Accueil"},
    {id:"officiel", label:"Officiel"},
    {id:"evaluations", label:"Evaluations"},
    {id:"matricules", label:"Matricules"},
    {id:"affichage", label:"Affichage"},
    ...(canManageLifecycle ? [{id:"danger", label:"Danger"}] : []),
  ];

  // Vue comptable : court-circuite le shell à onglets, sélecteur de
  // monnaie uniquement (seul champ autorisé par les règles Firestore).
  if(isComptableSeul) {
    return (
      <MonnaieComptableView
        form={form} setForm={setForm} chg={chg}
        chargement={chargement} msgSucces={msgSucces} erreur={erreur}
        sauvegarder={sauvegarder}
        inp={inp} lbl={lbl} sec={sec}
      />
    );
  }

  return (
    <div style={{padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",maxWidth:760,margin:"0 auto"}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:C.blueDark}}>⚙️ Paramètres de l'école</h2>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#9ca3af"}}>Personnalisez l'identité visuelle et les informations de votre établissement</p>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:24,width:"fit-content"}}>
        {tabItems.map(t=>(
          <button key={t.id} onClick={()=>setTabParam(t.id)} style={{
            padding:"8px 18px",border:"none",borderRadius:9,cursor:"pointer",
            fontSize:13,fontWeight:700,
            background:tabParam===t.id?"#fff":"transparent",
            color:tabParam===t.id?C.blueDark:"#64748b",
            boxShadow:tabParam===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
            transition:"all .15s",
          }}>{t.label}</button>
        ))}
      </div>

      {msgSucces&&<div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#065f46",fontWeight:600}}>✅ {msgSucces}</div>}
      {erreur&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>{erreur}</div>}

      {tabParam==="identite" && (
        <IdentiteTab
          form={form} setForm={setForm} chg={chg} schoolInfo={schoolInfo}
          apercu={apercu} handleLogoFile={handleLogoFile} resetLogo={resetLogo}
          couleursDetectees={couleursDetectees} setCouleursDetectees={setCouleursDetectees}
          appliquerCouleursDetectees={appliquerCouleursDetectees}
          setMigrationOuverte={setMigrationOuverte}
          inp={inp} lbl={lbl} sec={sec}
        />
      )}

      {migrationOuverte && <MigrationPeriodesModal fermer={()=>setMigrationOuverte(false)}/>}

      {tabParam==="evaluations" && (
        <EvaluationsTab
          evaluationForms={evaluationForms}
          setEvaluationLabel={setEvaluationLabel}
          toggleEvaluationActive={toggleEvaluationActive}
          inp={inp} sec={sec}
        />
      )}

      {tabParam==="accueil" && (
        <AccueilTab
          accueil={accueil} setAccueil={setAccueil} chgA={chgA}
          handleBanniere={handleBanniere} handlePhotoGalerie={handlePhotoGalerie}
          honneurs={honneurs} ajHonneur={ajHonneur} modHonneur={modHonneur} supHonneur={supHonneur}
          formHonneur={formHonneur} setFormHonneur={setFormHonneur}
          modalH={modalH} setModalH={setModalH}
          toast={toast}
          inp={inp} lbl={lbl} sec={sec}
        />
      )}

      {tabParam==="officiel" && (
        <OfficielTab
          form={form} chg={chg}
          peutEditerLegal={peutEditerLegal}
          inp={inp} lbl={lbl} sec={sec}
        />
      )}

      {tabParam==="matricules"&&<MatriculeSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}
      {tabParam==="affichage"&&<AffichageSettings sec={sec} lbl={lbl} inp={inp} setMsgSucces={setMsgSucces} setErreur={setErreur}/>}

      {tabParam==="danger" && canManageLifecycle && (
        <DangerTab
          dangerConfig={dangerConfig}
          dangerAction={dangerAction} setDangerAction={setDangerAction}
          dangerConfirmation={dangerConfirmation} setDangerConfirmation={setDangerConfirmation}
          dangerLoading={dangerLoading}
          lancerActionEcole={lancerActionEcole}
          setErreur={setErreur} setMsgSucces={setMsgSucces}
          schoolInfo={schoolInfo} schoolId={schoolId}
          inp={inp} sec={sec}
        />
      )}

      {/* Bouton sauvegarder (identité / officiel / accueil) */}
      {["identite","accueil","officiel","evaluations"].includes(tabParam)&&<button onClick={sauvegarder} disabled={chargement}
        style={{width:"100%",background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",
          border:"none",padding:"13px",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer",
          opacity:chargement?0.7:1}}>
        {chargement?"Enregistrement…":"💾 Enregistrer les paramètres"}
      </button>}

      <p style={{textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:12}}>
        Code école : <strong style={{color:C.blue}}>{schoolId}</strong> · Les modifications sont visibles immédiatement dans la sidebar et au prochain chargement.
      </p>
    </div>
  );
}

export { ParametresEcole };
