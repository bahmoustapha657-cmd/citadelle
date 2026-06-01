import { Btn } from "../../ui";

// Barre de filtres de la grille (classe, période, type) et boutons
// d'enregistrement/annulation du lot de modifications en cours.
export function NotesGrilleToolbar({
  classesUniqN, periodes, noteForms,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleChanges, setGrilleChanges, grilleSaving, sauvegarderGrille,
}) {
  const nbModif = Object.keys(grilleChanges).length;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <select value={grilleClasse} onChange={e => setGrilleClasse(e.target.value)}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
        <option value="all">Toutes</option>
        {classesUniqN.map(c => <option key={c}>{c}</option>)}
      </select>
      <select value={grillePeriode} onChange={e => setGrillePeriode(e.target.value)}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
        {periodes.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={grilleType} onChange={e => setGrilleType(e.target.value)}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12 }}>
        {noteForms.map(item => <option key={item.id} value={item.value}>{item.label}</option>)}
      </select>
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
