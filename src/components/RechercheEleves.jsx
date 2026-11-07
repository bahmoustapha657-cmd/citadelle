import { C } from "../constants";
import { CRITERES_RECHERCHE } from "../recherche-eleves";
import { Btn } from "./ui";

// Barre « 🔎 Chercher » des listes d'élèves (cf. use-recherche-eleves.js) :
// critère, saisie, nombre trouvé, puis les pistes hors de la vue et, en
// recherche collective, les termes restés sans résultat.
export function RechercheEleves({ recherche, nbTrouves = 0, pistes = [], sansResultat = [] }) {
  const { saisie, setSaisie, critere, setCritere, active } = recherche;
  const exemple = (CRITERES_RECHERCHE.find((c) => c.id === critere) || CRITERES_RECHERCHE[0]).exemple;
  return (
    <div style={{
      marginBottom: 12, padding: "8px 12px", borderRadius: 8,
      border: `1px solid ${active ? C.blue : "#b0c4d8"}`, background: active ? "#f0f6ff" : "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", fontWeight: 600 }}>
          🔎 Chercher par
          <select value={critere} onChange={(e) => setCritere(e.target.value)}
            style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "#fff", color: C.blueDark, fontWeight: 600 }}>
            {CRITERES_RECHERCHE.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <input
          type="text" value={saisie} onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setSaisie(""); }}
          inputMode={critere === "telTuteur" ? "tel" : "text"}
          aria-label="Rechercher des élèves"
          placeholder={`Ex. ${exemple} — plusieurs : séparez par des virgules`}
          style={{ flex: "1 1 240px", minWidth: 0, border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: C.blueDark, background: "#fff" }}
        />
        {active && (
          <span style={{ fontSize: 12, fontWeight: 700, color: nbTrouves ? C.blue : "#b91c1c", whiteSpace: "nowrap" }}>
            {nbTrouves ? `${nbTrouves} élève(s) trouvé(s)` : "Aucun élève trouvé"}
          </span>
        )}
        {active && <Btn sm v="ghost" title="Effacer la recherche (Échap)" onClick={() => setSaisie("")}>✕ Effacer</Btn>}
      </div>
      {active && (pistes.length > 0 || sansResultat.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
          {pistes.length > 0 && <span style={{ color: "#475569", fontWeight: 600 }}>Aussi trouvé :</span>}
          {pistes.map((p) => (
            <Btn key={p.cle} sm v="ghost" onClick={p.aller}>{p.label} ({p.n})</Btn>
          ))}
          {sansResultat.length > 0 && (
            <span style={{ color: "#b45309", fontWeight: 600 }}>Sans résultat ici : {sansResultat.join(", ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
