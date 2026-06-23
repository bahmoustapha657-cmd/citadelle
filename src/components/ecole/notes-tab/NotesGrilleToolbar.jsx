import { useState } from "react";
import { Btn } from "../../ui";

// Barre de filtres de la grille, selon le mode de saisie :
//   "periode" : classe + période + type      (colonnes = matières)
//   "matiere" : classe + matière + type      (colonnes = périodes)
//   "eleve"   : classe + élève + type        (lignes = matières, colonnes = périodes)
const MODES = [
  { id: "periode", label: "Par période" },
  { id: "matiere", label: "Par matière" },
  { id: "eleve", label: "Par élève" },
];

export function NotesGrilleToolbar({
  classesUniqN, periodes, noteForms, matieresClasse, elevesGrille,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleMode, setGrilleMode, grilleMatiere, setGrilleMatiere, grilleEleve, setGrilleEleve,
  grilleChanges, setGrilleChanges, grilleSaving, sauvegarderGrille,
}) {
  const nbModif = Object.keys(grilleChanges).length;
  const selStyle = { border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 12 };
  const changerMode = (id) => { setGrilleMode(id); setGrilleChanges({}); };

  // Recherche d'élève (mode « Par élève ») : filtre la liste par nom/prénom.
  const [rechEleve, setRechEleve] = useState("");
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const elevesFiltres = rechEleve.trim()
    ? elevesGrille.filter(e => e._id === grilleEleve || norm(`${e.nom} ${e.prenom}`).includes(norm(rechEleve)) || norm(`${e.prenom} ${e.nom}`).includes(norm(rechEleve)))
    : elevesGrille;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {/* Sélecteur de mode */}
      <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => changerMode(m.id)} style={{
            padding: "5px 11px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11.5, fontWeight: 700,
            background: grilleMode === m.id ? "#fff" : "transparent",
            color: grilleMode === m.id ? "#0A1628" : "#64748b",
            boxShadow: grilleMode === m.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}>{m.label}</button>
        ))}
      </div>

      <select value={grilleClasse} onChange={e => setGrilleClasse(e.target.value)} style={selStyle}>
        <option value="all">Toutes</option>
        {classesUniqN.map(c => <option key={c}>{c}</option>)}
      </select>

      {grilleMode === "periode" && (
        <select value={grillePeriode} onChange={e => setGrillePeriode(e.target.value)} style={selStyle}>
          {periodes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {grilleMode === "matiere" && (
        <select value={grilleMatiere} onChange={e => setGrilleMatiere(e.target.value)} style={selStyle}>
          <option value="">— Matière —</option>
          {matieresClasse.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {grilleMode === "eleve" && (
        <>
          <input
            value={rechEleve}
            onChange={e => setRechEleve(e.target.value)}
            placeholder="🔍 Rechercher un élève…"
            style={{ ...selStyle, minWidth: 170 }}
          />
          <select value={grilleEleve} onChange={e => setGrilleEleve(e.target.value)} style={{ ...selStyle, minWidth: 180 }}>
            <option value="">{elevesFiltres.length ? "— Élève —" : "Aucun élève trouvé"}</option>
            {elevesFiltres.map(e => <option key={e._id} value={e._id}>{e.nom} {e.prenom}</option>)}
          </select>
        </>
      )}

      <select value={grilleType} onChange={e => setGrilleType(e.target.value)} style={selStyle}>
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
