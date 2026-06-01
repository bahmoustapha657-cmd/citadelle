import { C } from "../../../constants";

// Sections affichées (annonces / contact) + informations de contact.
export function ContactSection({ accueil, chgA, inp, lbl, sec }) {
  return (
    <>
      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>👁️ Sections affichées</h3>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {key:"showAnnonces", label:"Annonces de l'école"},
            {key:"showContact",  label:"Informations de contact"},
          ].map(({key,label})=>(
            <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:"#374151"}}>
              <input type="checkbox" checked={accueil[key]} onChange={chgA(key)} style={{width:16,height:16}}/>
              <span style={{fontWeight:600}}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={sec}>
        <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📞 Informations de contact</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div><label style={lbl}>Téléphone</label><input style={inp} value={accueil.telephone} onChange={chgA("telephone")} placeholder="+224 6XX XXX XXX"/></div>
          <div><label style={lbl}>Email</label><input style={inp} value={accueil.email} onChange={chgA("email")} placeholder="contact@ecole.gn"/></div>
          <div><label style={lbl}>WhatsApp</label><input style={inp} value={accueil.whatsapp} onChange={chgA("whatsapp")} placeholder="+224 6XX XXX XXX"/></div>
          <div><label style={lbl}>Facebook</label><input style={inp} value={accueil.facebook} onChange={chgA("facebook")} placeholder="facebook.com/monecole"/></div>
        </div>
        <label style={lbl}>Adresse physique</label>
        <input style={inp} value={accueil.adresse} onChange={chgA("adresse")} placeholder="Ex. : Quartier Madina, Kindia, Guinée"/>
      </div>
    </>
  );
}
