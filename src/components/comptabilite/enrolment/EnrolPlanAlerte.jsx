import { Trans, useTranslation } from "react-i18next";

// Alerte affichée quand la limite d'élèves du plan est atteinte.
export function EnrolPlanAlerte({ planInfo }) {
  const { t } = useTranslation();
  if (!planInfo || planInfo.peutAjouterEleve) return null;
  return (
    <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center"}}>
      <span style={{fontSize:28}}>🔒</span>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 4px",fontWeight:900,fontSize:14,color:"#92400e"}}>
          {t("accounting.enrol.limitTitle", { plan: planInfo.planLabel })}
        </p>
        <p style={{margin:0,fontSize:12,color:"#78350f"}}>
          <Trans i18nKey="accounting.enrol.limitBody" values={{ active: planInfo.totalElevesActifs, limit: planInfo.eleveLimit === Infinity ? "∞" : planInfo.eleveLimit }} components={{ b: <strong /> }} />
          {" "}{planInfo.planCourant==="gratuit" ? t("accounting.enrol.limitFree") : t("accounting.enrol.limitPaid")}
        </p>
      </div>
    </div>
  );
}
