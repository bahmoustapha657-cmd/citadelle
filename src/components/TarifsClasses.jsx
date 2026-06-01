import { C } from "../constants";
import { Btn } from "./ui";
import { useTarifsClasses } from "./tarifs-classes/use-tarifs-classes";
import { TarifsSectionTable } from "./tarifs-classes/TarifsSectionTable";

function TarifsClasses({
  saveTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc, canEdit,
}) {
  const getters = { saveTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc };
  const { ouvert, setOuvert, editing, saving, feedback, handleChange, sauvegarderTout, modifie, getPreviewTotal, setEditing } =
    useTarifsClasses(getters);

  return (
    <div style={{marginBottom:16,border:"1px solid #b0c4d8",borderRadius:10,overflow:"hidden"}}>
      <button onClick={()=>setOuvert(o=>!o)}
        style={{width:"100%",background:"#f0f6ff",border:"none",padding:"11px 16px",cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13,fontWeight:700,color:C.blueDark}}>
        <span>Tarifs par classe (mensualité, révision incluse, autre, inscription, réinscription)</span>
        <span style={{fontSize:11,fontWeight:400,color:"#6b7280"}}>{ouvert?"Fermer":"Voir / Modifier"}</span>
      </button>
      {ouvert&&(
        <div style={{padding:"16px 18px",background:"#fff"}}>
          {!canEdit&&<p style={{margin:"0 0 12px",fontSize:12,color:"#9ca3af"}}>Lecture seule - seuls le comptable, l'administrateur et la direction peuvent modifier les tarifs.</p>}
          <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>
            La mensualité facturée par élève additionne automatiquement la mensualité de base et le frais de révision.
          </p>
          {["primaire", "college", "lycee"].map((section) => (
            <TarifsSectionTable
              key={section} section={section} editing={editing} canEdit={canEdit}
              handleChange={handleChange} getPreviewTotal={getPreviewTotal}
              getTarifBase={getTarifBase} getTarifRevision={getTarifRevision} getTarifAutre={getTarifAutre}
              getTarifIns={getTarifIns} getTarifReinsc={getTarifReinsc}
            />
          ))}
          {feedback&&(
            <div style={{
              marginTop:10,padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,
              background:feedback.type==="success"?"#d1fae5":"#fee2e2",
              color:feedback.type==="success"?"#065f46":"#991b1b",
              border:`1px solid ${feedback.type==="success"?"#6ee7b7":"#fca5a5"}`,
            }}>{feedback.msg}</div>
          )}
          {canEdit&&(
            <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
              <Btn onClick={sauvegarderTout} disabled={saving||!modifie} v={modifie?"success":"ghost"}>
                {saving?"Enregistrement...":"Enregistrer les tarifs"}
              </Btn>
              {modifie&&!saving&&<Btn v="ghost" onClick={()=>setEditing({})}>Annuler</Btn>}
              {!modifie&&!saving&&!feedback&&(
                <span style={{fontSize:11,color:"#9ca3af"}}>Modifiez au moins un tarif pour activer le bouton.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { TarifsClasses };
