import { C } from "../constants";
import { AnneeScolaireCard } from "./admin/AnneeScolaireCard";
import { PromotionCard } from "./admin/PromotionCard";
import { RolesConfigCard } from "./admin/RolesConfigCard";
import { VerrousCard } from "./admin/VerrousCard";
import { useAdminPanel } from "./admin/admin-panel/use-admin-panel";
import { ComptesTable } from "./admin/admin-panel/ComptesTable";
import { MdpsInitiauxModale } from "./admin/admin-panel/MdpsInitiauxModale";
import { ResetMdpModale } from "./admin/admin-panel/ResetMdpModale";

// ══════════════════════════════════════════════════════════════
//  PANNEAU ADMIN — Gestion des mots de passe
// ══════════════════════════════════════════════════════════════
function AdminPanel({ annee, setAnnee, verrous = {}, schoolId, userRole }) {
  const a = useAdminPanel({ schoolId, userRole });
  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {a.schoolInfo?.logo&&<img src={a.schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Gestion des Accès</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Mots de passe & Année scolaire</p>
        </div>
      </div>

      <AnneeScolaireCard annee={annee} setAnnee={setAnnee} canEdit={a.peutGererRoles} />

      <PromotionCard schoolId={schoolId} schoolInfo={a.schoolInfo} toast={a.toast} userRole={userRole} />

      <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.blueDark}}>
        <strong>🔐 Rôle Administrateur :</strong> par défaut en lecture seule. La Direction Générale peut autoriser l'écriture module par module (Primaire, Secondaire, Calendrier, Examens, Messages). Comptabilité, Paramètres, Fondation, Gestion Accès et Historique restent systématiquement en lecture seule (modules système).
        {!a.peutGererRoles && <div style={{marginTop:6,fontSize:12,color:"#6b7280"}}>La configuration des rôles et l'accès Fondation sont réservés à la Direction Générale.</div>}
      </div>

      {a.peutGererRoles && <RolesConfigCard
        schoolInfo={a.schoolInfo} setSchoolInfo={a.setSchoolInfo}
        schoolId={schoolId} toast={a.toast} setMdpsInitiaux={a.setMdpsInitiaux}
      />}

      {/* Modale mots de passe initiaux — affichée une seule fois */}
      {a.mdpsInitiaux && <MdpsInitiauxModale mdpsInitiaux={a.mdpsInitiaux} setMdpsInitiaux={a.setMdpsInitiaux} />}

      <ComptesTable
        comptes={a.comptes} chargement={a.chargement} initEnCours={a.initEnCours}
        peutResetCompte={a.peutResetCompte} setForm={a.setForm} setModal={a.setModal}
      />

      {/* ── CONTRÔLE DES MODIFICATIONS — réservé direction (verrou pose la
              question du droit de modifier des enregistrements déjà saisis ;
              les rules ecoles/{id} update interdisent toute modif sauf direction) ── */}
      {a.peutGererRoles && <VerrousCard verrous={verrous} schoolId={schoolId} />}

      {a.modal==="mdp" && <ResetMdpModale form={a.form} chg={a.chg} setModal={a.setModal} sauvegarder={a.sauvegarder} />}
    </div>
  );
}

export { AdminPanel };
