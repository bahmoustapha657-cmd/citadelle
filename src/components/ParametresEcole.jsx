import { C } from "../constants";
import { AffichageSettings } from "./AffichageSettings";
import { MatriculeSettings } from "./MatriculeSettings";
import { MigrationPeriodesModal } from "./MigrationPeriodesModal";
import { ParametresTabs } from "./parametres/ParametresTabs";
import { IdentiteTab } from "./parametres/IdentiteTab";
import { EvaluationsTab } from "./parametres/EvaluationsTab";
import { AccueilTab } from "./parametres/AccueilTab";
import { OfficielTab } from "./parametres/OfficielTab";
import { DangerTab } from "./parametres/DangerTab";
import { MonnaieComptableView } from "./parametres/MonnaieComptableView";
import { useParametresEcole } from "./parametres/use-parametres-ecole";

// Orchestrateur de l'écran "Paramètres de l'école".
// Toute la logique (état partagé, sauvegarde, cycle de vie, uploads) vit
// dans le hook useParametresEcole ; chaque onglet dans parametres/*Tab.jsx.
function ParametresEcole({ utilisateurRole = "", onSchoolClosed = null, initialTab = null, onTabConsumed = null }) {
  const p = useParametresEcole({ utilisateurRole, onSchoolClosed, initialTab, onTabConsumed });
  const {
    schoolId, schoolInfo, toast,
    honneurs, ajHonneur, modHonneur, supHonneur,
    tabParam, setTabParam,
    form, setForm, accueil, setAccueil, chg, chgA,
    formHonneur, setFormHonneur, modalH, setModalH,
    evaluationForms, setEvaluationLabel, toggleEvaluationActive,
    chargement, msgSucces, setMsgSucces, erreur, setErreur,
    migrationOuverte, setMigrationOuverte,
    apercu, couleursDetectees, setCouleursDetectees,
    dangerAction, setDangerAction, dangerConfirmation, setDangerConfirmation, dangerLoading,
    canManageLifecycle, peutEditerLegal, isComptableSeul, dangerConfig,
    handleLogoFile, appliquerCouleursDetectees, sauvegarder, lancerActionEcole,
    handlePhotoGalerie, handleBanniere, resetLogo,
    inp, lbl, sec, tabItems,
  } = p;

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

      <ParametresTabs tabItems={tabItems} tabParam={tabParam} setTabParam={setTabParam}/>

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
