import { PlansResume } from "./plans-tab/PlansResume";
import { EcolePlanRow } from "./plans-tab/EcolePlanRow";

// Onglet "Plans" du Panel Super-Admin.
// Pour chaque école : badge plan actuel + bouton "Modifier le plan"
// qui déploie un panneau inline (choix plan + durée) au-dessus de la
// ligne, scrollé automatiquement à l'ouverture.
// Le state du panneau (planModal, planChoix, planDuree…) reste dans
// le parent — cet onglet n'a pas de state interne propre.
export function PlansTab({
  ecoles, recherche, chargement,
  planModal, setPlanModal, planChoix, setPlanChoix, planDuree, setPlanDuree,
  planSaving, confirmDowngrade, setConfirmDowngrade, msgSucces, sauvegarderPlan, planPanelRef,
}) {
  // Snapshot du timestamp courant pour cette render : utilisé partout où
  // on compare contre planExpiry (badge "Expire", panneau d'édition…).
  // Date.now() est marqué impur par React Compiler ; ici c'est intentionnel
  // (on veut bien la valeur "au moment du render" pour le badge d'expiration).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expirationFutureLabel = new Date(now + planDuree * 86400000).toLocaleDateString("fr-FR");
  const ecolesFiltrees = ecoles.filter(e=>
    e.nom?.toLowerCase().includes(recherche.toLowerCase())||
    e._id?.toLowerCase().includes(recherche.toLowerCase())
  );
  return (
    <div>
      <PlansResume ecoles={ecoles} now={now} />

      {chargement ? (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement...</div>
      ) : ecoles.length===0 ? (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune ecole.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {ecolesFiltrees.map(ecole=>(
            <EcolePlanRow
              key={ecole._id} ecole={ecole} now={now}
              planModal={planModal} setPlanModal={setPlanModal}
              planChoix={planChoix} setPlanChoix={setPlanChoix}
              planDuree={planDuree} setPlanDuree={setPlanDuree}
              planSaving={planSaving} confirmDowngrade={confirmDowngrade} setConfirmDowngrade={setConfirmDowngrade}
              msgSucces={msgSucces} sauvegarderPlan={sauvegarderPlan}
              planPanelRef={planPanelRef} expirationFutureLabel={expirationFutureLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
