import React, { useState } from "react";
import { C } from "../../constants";
import { Btn, Card, Modale } from "../ui";
import { runPromotion } from "../admin-promotion";

export function PromotionCard({ schoolId, schoolInfo, toast }) {
  const [promoEn, setPromoEn] = useState(false);
  const [promoRes, setPromoRes] = useState(null);
  const [promoModal, setPromoModal] = useState(false);
  const [seuilCollege, setSeuilCollege] = useState(10);
  const [seuilPrimaire, setSeuilPrimaire] = useState(5);
  const [sansNotesBehavior, setSansNotesBehavior] = useState("promouvoir"); // "promouvoir" | "redoubler"

  const lancerPromotion = async () => {
    setPromoModal(false);
    setPromoEn(true);
    try {
      const res = await runPromotion({ schoolId, schoolInfo, seuilCollege, seuilPrimaire, sansNotesBehavior });
      setPromoRes(res);
      toast(`Promotion terminee — ${res.promus} promus, ${res.redoublants} redoublants`, "success");
    } catch(e) {
      toast("Erreur lors de la promotion : "+e.message, "error");
    } finally {
      setPromoEn(false);
    }
  };

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
            {promoRes&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
                <div style={{background:"#dcfce7",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>{promoRes.promus}</div>
                  <div style={{fontSize:11,color:"#15803d"}}>OK Promus</div>
                </div>
                <div style={{background:"#fee2e2",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#b91c1c"}}>{promoRes.redoublants}</div>
                  <div style={{fontSize:11,color:"#b91c1c"}}>🔁 Redoublants</div>
                </div>
                <div style={{background:"#fef9c3",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#854d0e"}}>{promoRes.terminalistes}</div>
                  <div style={{fontSize:11,color:"#854d0e"}}>🏁 Fin de cycle</div>
                </div>
                {promoRes.sansNotes>0&&<div style={{background:"#f3f4f6",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"#6b7280"}}>{promoRes.sansNotes}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>📭 Sans notes</div>
                </div>}
              </div>
              {promoRes.details&&promoRes.details.length>0&&<details style={{marginBottom:12}}>
                <summary style={{fontSize:12,cursor:"pointer",color:C.blue,fontWeight:700}}>
                  Voir le détail ({promoRes.details.length} élèves)
                </summary>
                <div style={{overflowX:"auto",marginTop:8}}>
                  <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{fontSize:12}}>
                    <thead><tr style={{background:"#f0f6ff"}}>
                      <th style={{padding:"5px 8px",textAlign:"left"}}>Éleve</th>
                      <th style={{padding:"5px 8px"}}>Classe actuelle</th>
                      <th style={{padding:"5px 8px"}}>Moy. annuelle</th>
                      <th style={{padding:"5px 8px"}}>Décision</th>
                      <th style={{padding:"5px 8px"}}>Nouvelle classe</th>
                    </tr></thead>
                    <tbody>{promoRes.details.map((d,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #e5e7eb",background:d.statut==="promu"?"#f0fdf4":"#fef2f2"}}>
                        <td style={{padding:"4px 8px",fontWeight:700}}>{d.nom}</td>
                        <td style={{padding:"4px 8px",textAlign:"center"}}>{d.classe}</td>
                        <td style={{padding:"4px 8px",textAlign:"center",fontWeight:800,
                          color:d.moy===null?"#9ca3af":d.statut==="promu"?"#15803d":"#b91c1c"}}>
                          {d.moy===null?"—":d.moy.toFixed(2)}
                        </td>
                        <td style={{padding:"4px 8px",textAlign:"center"}}>
                          <span style={{padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700,
                            background:d.statut==="promu"?"#dcfce7":"#fee2e2",
                            color:d.statut==="promu"?"#15803d":"#b91c1c"}}>
                            {d.statut==="promu"?"OK Promu":"🔁 Redoublant"}
                          </span>
                        </td>
                        <td style={{padding:"4px 8px",textAlign:"center",color:"#6b7280"}}>
                          {d.nouvClasse||"—"}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
              </details>}
            </>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="amber" onClick={()=>setPromoModal(true)} disabled={promoEn}>
                {promoEn?"⏳ En cours...":"Promotion Lancer la promotion"}
              </Btn>
              {promoRes&&<Btn v="ghost" onClick={()=>setPromoRes(null)}>Effacer le résultat</Btn>}
            </div>
          </div>
        </div>
      </Card>

      {/* Modal config promotion */}
      {promoModal&&<Modale titre="⚙️ Configuration de la promotion" fermer={()=>setPromoModal(false)}>
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
            {[["promouvoir","OK Promouvoir automatiquement"],["redoubler","🔁 Faire redoubler automatiquement"]].map(([v,lbl])=>(
              <label key={v} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
                <input type="radio" name="sansNotes" value={v}
                  checked={sansNotesBehavior===v} onChange={()=>setSansNotesBehavior(v)}/>
                {lbl}
              </label>
            ))}
          </div>
        </div>
        <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
          Attention : cette action est <strong>irréversible</strong>. Les classes de tous les élèves promus seront immédiatement mises à jour dans Firestore.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={()=>setPromoModal(false)}>Annuler</Btn>
          <Btn v="amber" onClick={lancerPromotion}>Promotion Confirmer et lancer</Btn>
        </div>
      </Modale>}
    </>
  );
}
