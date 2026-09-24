import { C } from "../../constants";
import { Btn, Card } from "../ui";
import { usePromotionCard } from "./promotion-card/use-promotion-card";
import { PromotionResultats } from "./promotion-card/PromotionResultats";
import { PromotionConfigModale } from "./promotion-card/PromotionConfigModale";
import { dateLongue } from "./cloture-annee-utils";

export function PromotionCard({ schoolId, schoolInfo, toast, userRole }) {
  const p = usePromotionCard({ schoolId, schoolInfo, toast });
  // Action de masse irréversible : réservée à la Direction (l'admin est en
  // lecture seule sur Gestion Accès — les règles Firestore le bloqueraient
  // de toute façon, autant ne pas lui montrer un bouton qui échoue).
  const peutLancer = userRole === "direction" || userRole === "superadmin";
  const { etat } = p;
  const dateIso = (iso) => (iso ? dateLongue(new Date(iso)) : "");

  return (
    <>
      <Card style={{marginBottom:20,padding:"16px 20px",border:"2px solid #fef3c7"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <span style={{fontSize:28}}>🎓</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>
              Promotion de fin d'année{etat.statut!=="attente"?` ${etat.annee}`:""}
            </p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
              Avance les élèves de l'année clôturée dont la moyenne annuelle atteint le seuil de passage
              (Petite Section → … → 12ème Année). Les classes d'examen (6ème Année, 10ème Année, Terminale)
              passent par le « Passage des admis ». Lancez d'abord une simulation pour vérifier le résultat sans rien modifier.
            </p>

            {etat.statut==="attente"&&<p style={{margin:"0 0 12px",padding:"8px 12px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e",fontWeight:600}}>
              🔒 La promotion se lance après la clôture de l'année {p.anneeOfficielle}
              {p.clotureSuivante.fin?` — possible à partir du ${dateLongue(p.clotureSuivante.fin)}`:""}.
            </p>}
            {etat.statut==="appliquee"&&<p style={{margin:"0 0 12px",padding:"8px 12px",background:"#dcfce7",borderRadius:8,fontSize:12,color:"#15803d",fontWeight:600}}>
              ✅ Promotion {etat.annee} appliquée le {dateIso(etat.appliquee.le)} — {etat.appliquee.promus} promu(s),
              {" "}{etat.appliquee.redoublants} redoublant(s). Elle ne peut pas être relancée.
            </p>}
            {etat.statut==="possible"&&<p style={{margin:"0 0 12px",fontSize:12,color:C.greenDk,fontWeight:600}}>
              Année {etat.annee} clôturée le {dateIso(etat.cloture.le)} : sa promotion peut être lancée, une seule fois.
            </p>}

            <PromotionResultats promoRes={p.promoRes}/>
            {!peutLancer ? (
              <p style={{margin:0,fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>
                🔒 Action réservée à la Direction Générale.
              </p>
            ) : etat.statut==="possible" ? (
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Btn v="amber" onClick={()=>p.setPromoModal(true)} disabled={p.promoEn}>
                  {p.promoEn?"⏳ En cours…":"🎓 Lancer la promotion"}
                </Btn>
                {p.promoRes?.simulation && (
                  <Btn onClick={()=>p.lancerPromotion(false)} disabled={p.promoEn}>
                    ✅ Appliquer cette promotion
                  </Btn>
                )}
                {p.promoRes&&<Btn v="ghost" onClick={()=>p.setPromoRes(null)}>Effacer le résultat</Btn>}
              </div>
            ) : (
              p.promoRes&&<Btn v="ghost" onClick={()=>p.setPromoRes(null)}>Effacer le résultat</Btn>
            )}
          </div>
        </div>
      </Card>

      {p.promoModal&&<PromotionConfigModale
        seuilCollege={p.seuilCollege} setSeuilCollege={p.setSeuilCollege}
        seuilPrimaire={p.seuilPrimaire} setSeuilPrimaire={p.setSeuilPrimaire}
        sansNotesBehavior={p.sansNotesBehavior} setSansNotesBehavior={p.setSansNotesBehavior}
        fermer={()=>p.setPromoModal(false)} lancerPromotion={p.lancerPromotion}/>}
    </>
  );
}
