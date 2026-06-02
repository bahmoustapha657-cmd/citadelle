// Alerte affichée quand la limite d'élèves du plan est atteinte.
export function EnrolPlanAlerte({ planInfo }) {
  if (!planInfo || planInfo.peutAjouterEleve) return null;
  return (
    <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center"}}>
      <span style={{fontSize:28}}>🔒</span>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 4px",fontWeight:900,fontSize:14,color:"#92400e"}}>
          Limite d'élèves atteinte — Plan {planInfo.planLabel}
        </p>
        <p style={{margin:0,fontSize:12,color:"#78350f"}}>
          Vous avez <strong>{planInfo.totalElevesActifs}</strong> élèves actifs
          sur <strong>{planInfo.eleveLimit === Infinity ? "∞" : planInfo.eleveLimit}</strong> autorisés.
          {planInfo.planCourant==="gratuit"
            ? " Contactez le Super-Admin pour activer un abonnement et inscrire plus d'élèves."
            : " Contactez le Super-Admin pour passer à un plan supérieur."}
        </p>
      </div>
    </div>
  );
}
