import { C } from "../../../constants";

// Barre d'outils : recherche + actions globales (création, actualisation).
export function EcolesToolbar({
  recherche, setRecherche,
  setCreationOuverte,
  chargerEcoles,
  S,
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
      <input value={recherche} onChange={e => setRecherche(e.target.value)}
        placeholder="Rechercher une ecole..."
        style={{ ...S.input, flex: 1, minWidth: 200 }} />
      <button onClick={() => setCreationOuverte(true)}
        style={{ ...S.btn(C.blue), padding: "8px 18px", fontSize: 13, background: `linear-gradient(90deg,${C.blue},${C.green})` }}>
        + Nouvelle ecole
      </button>
      <button onClick={chargerEcoles}
        style={{ ...S.btn("#6b7280"), background: "#f3f4f6", color: "#374151", padding: "8px 14px", fontSize: 13 }}>
        Actualiser
      </button>
    </div>
  );
}
