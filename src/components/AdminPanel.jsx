import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { Tabs } from "./ui";
import { AnneeScolaireCard } from "./admin/AnneeScolaireCard";
import { PromotionCard } from "./admin/PromotionCard";
import { PassageAdmisCard } from "./admin/PassageAdmisCard";
import { PostesCard } from "./admin/postes/PostesCard";
import { SignaturesCard } from "./admin/signatures/SignaturesCard";
import { DoublonsParentsCard } from "./admin/doublons/DoublonsParentsCard";
import { EspacesMultiplesCard } from "./admin/espaces/EspacesMultiplesCard";
import { VerrousCard } from "./admin/VerrousCard";
import { useAdminPanel } from "./admin/admin-panel/use-admin-panel";
import { ComptesOnglet } from "./admin/admin-panel/ComptesOnglet";
import { MdpsInitiauxModale } from "./admin/admin-panel/MdpsInitiauxModale";
import { ResetMdpModale } from "./admin/admin-panel/ResetMdpModale";

// ══════════════════════════════════════════════════════════════
//  COMPTES & POSTES — un onglet par usage
// ══════════════════════════════════════════════════════════════
// Neuf cartes s'empilaient sur une seule page : la liste des comptes (pour
// changer un mot de passe) arrivait tout en bas, sous les postes et les
// signatures, et la clôture de l'année ouvrait la page. Chaque usage a
// désormais son onglet ; un onglet déjà ouvert reste monté (caché), pour ne
// perdre ni une analyse de doublons ni une clôture en cours.
function AdminPanel({ annee, setAnnee, verrous = {}, schoolId, userRole }) {
  const { t } = useTranslation();
  const a = useAdminPanel({ schoolId, userRole });
  const onglets = [
    { id: "comptes", label: `${t("comptesPostes.onglets.comptes")}${a.chargement ? "" : ` (${a.comptes.length})`}` },
    { id: "postes", label: t("comptesPostes.onglets.postes") },
    { id: "signatures", label: t("comptesPostes.onglets.signatures") },
    a.peutGererRoles && { id: "autorisations", label: t("comptesPostes.onglets.autorisations") },
    a.peutGererRoles && { id: "doublons", label: t("comptesPostes.onglets.doublons") },
    { id: "annee", label: t("comptesPostes.onglets.annee") },
  ].filter(Boolean);

  const [choisi, setChoisi] = useState("comptes");
  const [ouverts, setOuverts] = useState(() => new Set(["comptes"]));
  const onglet = onglets.some((o) => o.id === choisi) ? choisi : "comptes";
  const ouvrir = (id) => {
    setChoisi(id);
    setOuverts((s) => (s.has(id) ? s : new Set(s).add(id)));
  };
  const panneau = (id, contenu) => ouverts.has(id) && (
    <div key={id} role="tabpanel" style={onglet === id ? undefined : { display: "none" }}>{contenu}</div>
  );

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {a.schoolInfo?.logo&&<img crossOrigin="anonymous" src={a.schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Comptes & Postes</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Comptes, droits, signataires & Année scolaire</p>
        </div>
      </div>

      <Tabs items={onglets} actif={onglet} onChange={ouvrir} />

      {panneau("comptes", (
        <ComptesOnglet
          comptes={a.comptes} chargement={a.chargement} initEnCours={a.initEnCours}
          peutResetCompte={a.peutResetCompte} setForm={a.setForm} setModal={a.setModal}
          allerAuxPostes={() => ouvrir("postes")}
        />
      ))}

      {panneau("postes", (
        <>
          <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.blueDark}}>
            <strong>🧩 Postes flexibles :</strong> chaque poste porte ses propres droits (invisible / lecture / écriture) module par module, et peut avoir plusieurs comptes. Le poste Direction garde toujours tous les droits.
            {!a.peutGererRoles && <div style={{marginTop:6,fontSize:12,color:"#6b7280"}}>La gestion des postes est réservée à la Direction Générale.</div>}
          </div>
          <PostesCard
            schoolId={schoolId} peutGererRoles={a.peutGererRoles}
            comptes={a.comptes} refreshComptes={a.refreshComptes}
            toast={a.toast} setMdpsInitiaux={a.setMdpsInitiaux}
          />
        </>
      ))}

      {panneau("signatures", (
        <SignaturesCard schoolId={schoolId} peutGererRoles={a.peutGererRoles} toast={a.toast} comptes={a.comptes} />
      ))}

      {/* Contrôle des modifications — réservé à la Direction : le verrou
          décide qui peut corriger des enregistrements déjà saisis. */}
      {a.peutGererRoles && panneau("autorisations", <VerrousCard verrous={verrous} schoolId={schoolId} />)}

      {/* Un parent, plusieurs comptes (fusion) ; une personne, plusieurs
          espaces (liaison) : la Direction seulement. */}
      {a.peutGererRoles && panneau("doublons", (
        <>
          <DoublonsParentsCard schoolId={schoolId} toast={a.toast} />
          <EspacesMultiplesCard toast={a.toast} />
        </>
      ))}

      {panneau("annee", (
        <>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#64748b",lineHeight:1.5}}>{t("comptesPostes.anneeEtapes")}</p>
          <AnneeScolaireCard
            annee={annee} setAnnee={setAnnee} canEdit={a.peutGererRoles}
            schoolId={schoolId} toast={a.toast}
          />
          <PromotionCard schoolId={schoolId} schoolInfo={a.schoolInfo} toast={a.toast} userRole={userRole} />
          <PassageAdmisCard schoolId={schoolId} schoolInfo={a.schoolInfo} toast={a.toast} userRole={userRole} />
        </>
      ))}

      {/* Modale mots de passe initiaux — affichée une seule fois, quel que
          soit l'onglet (création d'un compte, ou comptes par défaut). */}
      {a.mdpsInitiaux && <MdpsInitiauxModale mdpsInitiaux={a.mdpsInitiaux} setMdpsInitiaux={a.setMdpsInitiaux} />}
      {a.modal==="mdp" && <ResetMdpModale form={a.form} chg={a.chg} setModal={a.setModal} sauvegarder={a.sauvegarder} />}
    </div>
  );
}

export { AdminPanel };
