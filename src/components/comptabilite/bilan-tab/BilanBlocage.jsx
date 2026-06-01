// Bandeau de contrôle d'accès parent : indique si le portail Notes & Bulletins
// est bloqué pour les parents en impayé, avec bouton de bascule.
export function BilanBlocage({ blocage, canCreate, toggleBlocage }) {
  return (
    <div style={{background:blocage?"#fff0f0":"#f0fdf4",border:`2px solid ${blocage?"#f87171":"#4ade80"}`,borderRadius:14,padding:"18px 20px",marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{fontSize:34,lineHeight:1}}>{blocage?"🔒":"🔓"}</span>
        <div style={{flex:1,minWidth:180}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontWeight:900,fontSize:14,color:"#1e293b"}}>Portail parents — Notes & Bulletins</span>
            <span style={{
              display:"inline-block",padding:"3px 12px",borderRadius:20,fontWeight:900,fontSize:12,letterSpacing:.5,
              background:blocage?"#b91c1c":"#15803d",color:"#fff",
            }}>{blocage?"🔴 BLOQUÉ":"🟢 OUVERT"}</span>
          </div>
          <div style={{fontSize:12,color:"#6b7280"}}>
            {blocage
              ? "Les parents d'élèves avec mensualités impayées ne peuvent pas consulter ni imprimer les notes et bulletins."
              : "Tous les parents peuvent consulter et imprimer les notes et bulletins."}
          </div>
        </div>
        {canCreate&&(
          <button onClick={toggleBlocage} style={{
            background:blocage?"#15803d":"#b91c1c",color:"#fff",
            border:"none",padding:"10px 22px",borderRadius:10,cursor:"pointer",fontWeight:900,fontSize:13,
            whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(0,0,0,.15)",
          }}>
            {blocage?"🔓 Débloquer":"🔒 Bloquer"}
          </button>
        )}
      </div>
    </div>
  );
}
