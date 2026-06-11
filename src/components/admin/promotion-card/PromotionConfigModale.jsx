import { C } from "../../../constants";
import { Btn, Modale } from "../../ui";

// Modale de configuration de la promotion : seuils de passage par section,
// traitement des élèves sans notes, avertissement d'irréversibilité.
export function PromotionConfigModale({
  seuilCollege, setSeuilCollege, seuilPrimaire, setSeuilPrimaire,
  sansNotesBehavior, setSansNotesBehavior, fermer, lancerPromotion,
}) {
  return (
    <Modale titre="⚙️ Configuration de la promotion" fermer={fermer}>
      <p style={{margin:"0 0 16px",fontSize:13,color:"#374151"}}>
        Définissez le seuil de passage pour chaque section. Les élèves dont la moyenne annuelle est inférieure au seuil redoublent.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>
            Seuil College / Lycee (sur 20)
          </label>
          <input type="number" min={0} max={20} step={0.5} value={seuilCollege}
            onChange={e=>setSeuilCollege(e.target.value)}
            style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
          <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Defaut recommande : 10/20</p>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>
            Seuil Primaire (sur 10)
          </label>
          <input type="number" min={0} max={10} step={0.5} value={seuilPrimaire}
            onChange={e=>setSeuilPrimaire(e.target.value)}
            style={{width:"100%",border:"1.5px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:14,fontWeight:700,color:C.blue}}/>
          <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Defaut recommande : 5/10</p>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:6}}>
          Élèves sans notes (aucun devoir saisi)
        </label>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[["promouvoir","✅ Promouvoir automatiquement"],["redoubler","🔁 Faire redoubler automatiquement"]].map(([v,lbl])=>(
            <label key={v} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
              <input type="radio" name="sansNotes" value={v}
                checked={sansNotesBehavior===v} onChange={()=>setSansNotesBehavior(v)}/>
              {lbl}
            </label>
          ))}
        </div>
      </div>
      <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
        Attention : l'application est <strong>irréversible</strong> — les classes des élèves promus sont mises à jour immédiatement.
        Commencez par la <strong>simulation</strong> : elle montre le résultat complet sans rien modifier.
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn onClick={()=>lancerPromotion(true)}>🔍 Simuler (aucune modification)</Btn>
        <Btn v="amber" onClick={()=>lancerPromotion(false)}>🎓 Lancer définitivement</Btn>
      </div>
    </Modale>
  );
}
