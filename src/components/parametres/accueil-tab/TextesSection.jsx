import { C } from "../../../constants";

// Textes de la page d'accueil : slogan et message de bienvenue.
export function TextesSection({ accueil, chgA, inp, lbl, sec }) {
  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>✏️ Textes de la page</h3>
      <label style={lbl}>Slogan / Tagline</label>
      <input style={inp} value={accueil.slogan} onChange={chgA("slogan")} placeholder="Ex. : L'excellence au cœur de l'Afrique"/>
      <label style={lbl}>Message d'accueil</label>
      <textarea value={accueil.texteAccueil} onChange={chgA("texteAccueil")} rows={3}
        placeholder="Ex. : Bienvenue à l'École La Citadelle, un établissement d'excellence..."
        style={{...inp,resize:"vertical",fontFamily:"inherit"}}/>
    </div>
  );
}
