import { C } from "../../../constants";

// Barre d'outils : recherche + actions globales (création, actualisation).
//
// Deux outils de l'ère Firebase ont été retirés ici (liquidation, lot 4) après
// avoir été masqués un temps :
//   • « Sync ecoles publiques » appelait /ecole-public-sync, fonction Vercel
//     disparue avec le passage à Cloudflare. Sur Supabase la vitrine lit la RPC
//     etat_ecole : il n'y a aucun miroir à alimenter.
//   • « Migrer annee legacy » balayait tout Firestore en writeBatch pour poser
//     le champ `annee` — il ne touchait plus les vraies données depuis la
//     migration.
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
