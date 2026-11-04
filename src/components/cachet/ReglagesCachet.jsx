// Réglages de l'image du cachet, appliqués en direct à l'aperçu
// (preparer-cachet.js → rendreCachet) : papier, lumière, couleur de l'encre,
// redressement. Tout repart de la photo d'origine ; « Réinitialiser » la rend
// telle qu'elle a été prise, papier effacé.
import { Btn } from "../ui";
import { TON_MAX } from "../camera-capture/retouche";
import { COULEURS_ENCRE, INCLINAISON_MAX, REGLAGES_CACHET } from "./preparer-cachet";

const styleTitre = { margin: "14px 0 4px", fontSize: 12, fontWeight: 700, color: "#334155" };
const styleCurseur = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", marginTop: 6 };
const styleAide = { margin: "4px 0 0", fontSize: 11, color: "#64748b" };

const signe = (v) => (v > 0 ? `+${v}` : `${v}`);

function Curseur({ libelle, aide, min, max, step, value, onChange, unite = "", disabled }) {
  return (
    <label style={{ ...styleCurseur, opacity: disabled ? 0.5 : 1 }}>
      <strong style={{ whiteSpace: "nowrap", minWidth: 86 }}>{libelle}</strong>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={aide} style={{ flex: 1, minWidth: 0 }} />
      <span style={{ fontSize: 11, color: "#64748b", minWidth: 38, textAlign: "end" }}>{signe(value)}{unite}</span>
    </label>
  );
}

function PastilleEncre({ couleur, actif, disabled, onClick }) {
  return (
    <button type="button" aria-pressed={actif} disabled={disabled} onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: disabled ? "default" : "pointer",
        border: actif ? "2px solid #1e3a5f" : "1px solid #cbd5e1", background: actif ? "#e0ebf8" : "#fff",
        opacity: disabled ? 0.5 : 1,
      }}>
      <span aria-hidden="true" style={{
        width: 14, height: 14, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.15)",
        background: couleur.rgb ? `rgb(${couleur.rgb})` : "conic-gradient(#1b308a 0 33%, #562698 0 66%, #141824 0)",
      }} />
      {couleur.libelle}
    </button>
  );
}

export default function ReglagesCachet({ reglages: r, changer, desactive }) {
  const neutre = Object.keys(REGLAGES_CACHET).every((k) => r[k] === REGLAGES_CACHET[k]);
  const sansPapier = desactive || !r.nettoyer;
  return (
    <div>
      <p style={{ ...styleTitre, marginTop: 0 }}>🧽 Papier</p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
        <input type="checkbox" checked={r.nettoyer} disabled={desactive} onChange={(e) => changer({ nettoyer: e.target.checked })} />
        Effacer le papier autour de l'encre
      </label>
      <Curseur libelle="Effacement" aide="Effacement du papier, plus doux ou plus fort" min={-TON_MAX} max={TON_MAX} step={5}
        value={r.fond} disabled={sansPapier} onChange={(fond) => changer({ fond })} />
      <p style={styleAide}>Plus fort : ombres et grisé disparaissent. Plus doux : les traits pâles restent.</p>

      <p style={styleTitre}>☀️ Lumière</p>
      <Curseur libelle="Luminosité" aide="Luminosité : plus sombre ou plus clair" min={-TON_MAX} max={TON_MAX} step={5}
        value={r.luminosite} disabled={desactive} onChange={(luminosite) => changer({ luminosite })} />
      <Curseur libelle="Contraste" aide="Contraste : encre plus nette sur le papier" min={-TON_MAX} max={TON_MAX} step={5}
        value={r.contraste} disabled={desactive} onChange={(contraste) => changer({ contraste })} />

      <p style={styleTitre}>🎨 Couleur de l'encre</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {COULEURS_ENCRE.map((c) => (
          <PastilleEncre key={c.id} couleur={c} actif={r.encre === c.id} disabled={sansPapier}
            onClick={() => changer({ encre: c.id })} />
        ))}
      </div>
      <p style={styleAide}>
        {r.nettoyer
          ? "Une couleur unie donne au cachet et à la signature un rendu franc, comme imprimé."
          : "Effacez le papier pour choisir la couleur de l'encre."}
      </p>

      <p style={styleTitre}>📐 Redresser</p>
      <Curseur libelle="Inclinaison" aide="Inclinaison, en degrés" min={-INCLINAISON_MAX} max={INCLINAISON_MAX} step={0.5} unite="°"
        value={r.inclinaison} disabled={desactive} onChange={(inclinaison) => changer({ inclinaison })} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <Btn sm v="ghost" disabled={desactive} onClick={() => changer({ quart: (r.quart + 3) % 4 })}
          title="Tourner d'un quart de tour à gauche" aria-label="Tourner à gauche">⟲ Tourner</Btn>
        <Btn sm v="ghost" disabled={desactive} onClick={() => changer({ quart: (r.quart + 1) % 4 })}
          title="Tourner d'un quart de tour à droite" aria-label="Tourner à droite">⟳ Tourner</Btn>
        <Btn sm v="ghost" disabled={desactive || neutre} onClick={() => changer(REGLAGES_CACHET)}
          title="Revenir à la photo telle qu'elle a été prise, papier effacé">↺ Réinitialiser</Btn>
      </div>
    </div>
  );
}
