// Bloc de saisie de la prime horaire pour un créneau de révision.
export function CelluleRevisionPrime({ form, setForm }) {
  if ((form.type || "cours") !== "revision") return null;
  return (
    <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontSize:20}}>📝</span>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:700,color:"#9a3412",marginBottom:4}}>Prime horaire révision</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="number" min="0" value={form.primeRevision||""}
            onChange={e=>setForm(p=>({...p,primeRevision:e.target.value}))}
            placeholder="Ex : 50000"
            style={{border:"1px solid #fdba74",borderRadius:6,padding:"6px 10px",fontSize:13,width:140,background:"#fff"}}/>
          <span style={{fontSize:12,color:"#c2410c",fontWeight:600}}>GNF / heure</span>
        </div>
        <div style={{fontSize:11,color:"#c2410c",marginTop:4}}>Cette prime remplace la prime horaire normale pour ce créneau.</div>
      </div>
    </div>
  );
}
