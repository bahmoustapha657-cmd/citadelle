import { Btn } from "../../ui";

// Barre de filtres de la grille. Mode normal : classe + période + type
// (colonnes = matières). Mode multipériode : classe + matière + type
// (colonnes = périodes — saisir les 2-3 compositions d'un coup).
export function NotesGrilleToolbar({
  classesUniqN, periodes, noteForms, matieresClasse,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  multiPeriode, setMultiPeriode, grilleMatiere, setGrilleMatiere,
  grilleChanges, setGrilleChanges, grilleSaving, sauvegarderGrille,
}) {
  const nbModif = Object.keys(grilleChanges).length;
  const selStyle = { border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12 };
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <select value={grilleClasse} onChange={e => setGrilleClasse(e.target.value)} style={selStyle}>
        <option value="all">Toutes</option>
        {classesUniqN.map(c => <option key={c}>{c}</option>)}
      </select>

      {multiPeriode ? (
        // Matière figée → colonnes = périodes
        <select value={grilleMatiere} onChange={e => setGrilleMatiere(e.target.value)} style={selStyle}>
          <option value="">— Matière —</option>
          {matieresClasse.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        // Période figée → colonnes = matières
        <select value={grillePeriode} onChange={e => setGrillePeriode(e.target.value)} style={selStyle}>
          {periodes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}

      <select value={grilleType} onChange={e => setGrilleType(e.target.value)} style={selStyle}>
        {noteForms.map(item => <option key={item.id} value={item.value}>{item.label}</option>)}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer", background: multiPeriode ? "#e0ebf8" : "transparent", border: "1px solid #b0c4d8", borderRadius: 7, padding: "5px 10px" }}>
        <input type="checkbox" checked={multiPeriode} onChange={e => { setMultiPeriode(e.target.checked); setGrilleChanges({}); }} />
        🗓️ Toutes les périodes
      </label>

      {nbModif > 0 && (
        <Btn v="vert" sm disabled={grilleSaving} onClick={sauvegarderGrille}>
          {grilleSaving ? "Enregistrement…" : `💾 Enregistrer (${nbModif} modif.)`}
        </Btn>
      )}
      {nbModif > 0 && (
        <Btn v="ghost" sm onClick={() => setGrilleChanges({})}>✕ Annuler</Btn>
      )}
    </div>
  );
}
