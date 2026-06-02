import { C } from "../../constants";
import { Btn, Card } from "../ui";
import { usePromotionCard } from "./promotion-card/use-promotion-card";
import { PromotionResultats } from "./promotion-card/PromotionResultats";
import { PromotionConfigModale } from "./promotion-card/PromotionConfigModale";

export function PromotionCard({ schoolId, schoolInfo, toast }) {
  const p = usePromotionCard({ schoolId, schoolInfo, toast });

  return (
    <>
      <Card style={{marginBottom:20,padding:"16px 20px",border:"2px solid #fef3c7"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <span style={{fontSize:28}}>Promotion</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Promotion de fin d'année</p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
              Avance les élèves dont la moyenne annuelle atteint le seuil de passage. Les autres redoublent.
            </p>
            <PromotionResultats promoRes={p.promoRes}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="amber" onClick={()=>p.setPromoModal(true)} disabled={p.promoEn}>
                {p.promoEn?"⏳ En cours...":"Promotion Lancer la promotion"}
              </Btn>
              {p.promoRes&&<Btn v="ghost" onClick={()=>p.setPromoRes(null)}>Effacer le résultat</Btn>}
            </div>
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
