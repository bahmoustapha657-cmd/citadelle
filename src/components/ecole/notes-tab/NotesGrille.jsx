import { getAnnee } from "../../../constants";
import { C } from "../../../constants";
import { Btn, Vide } from "../../ui";
import { couleurNote } from "./notes-helpers";

// Vue grille de saisie des notes : une matière par colonne, un élève par
// ligne, édition inline avec lot de modifications enregistré en bloc.
export function NotesGrille({
  eleves,
  notes,
  matieresForClasse,
  noteForms,
  periodes,
  maxNote,
  annee,
  canCreate,
  ajN,
  toast,
  grilleClasse, setGrilleClasse,
  grillePeriode, setGrillePeriode,
  grilleType, setGrilleType,
  grilleChanges, setGrilleChanges,
  grilleSaving, setGrilleSaving,
}) {
  const classesUniqN = [...new Set(eleves.map(e => e.classe || ""))].filter(Boolean).sort();
  const elevesGrille = (grilleClasse === "all" ? eleves : eleves.filter(e => e.classe === grilleClasse))
    .filter(e => e.statut === "Actif" || !e.statut)
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  const matieresCols = matieresForClasse(grilleClasse === "all" ? null : grilleClasse).map(m => m.nom);

  // Recherche d'une note existante pour CET élève (et pas un autre).
  // Match par eleveId en priorité ; fallback strict sur eleveNom complet
  // (legacy : anciennes notes sans eleveId).
  const getNoteExist = (eleve, mat) => {
    if (!eleve) return undefined;
    const fullName = `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
    return notes.find(n => {
      if (n.matiere !== mat || n.periode !== grillePeriode || n.type !== grilleType) return false;
      if (n.eleveId) return n.eleveId === eleve._id;
      return !!fullName && String(n.eleveNom || "").trim() === fullName;
    });
  };

  const valeurCellule = (eleve, mat) => {
    const key = `${eleve._id}|${mat}`;
    if (key in grilleChanges) return grilleChanges[key];
    return getNoteExist(eleve, mat)?.note ?? "";
  };

  const sauvegarderGrille = async () => {
    if (!Object.keys(grilleChanges).length) { toast("Aucune modification.", "info"); return; }
    setGrilleSaving(true);
    let nb = 0;
    for (const [key, val] of Object.entries(grilleChanges)) {
      const [eleveId, ...matParts] = key.split("|");
      const mat = matParts.join("|");
      if (val === "" || isNaN(Number(val))) continue;
      const eleve = eleves.find(e => e._id === eleveId);
      if (!eleve) continue;
      const exist = getNoteExist(eleve, mat);
      if (exist) { await ajN({ ...exist, note: Number(val), annee: exist.annee || annee || getAnnee() }); }
      else { await ajN({ eleveId, eleveNom: `${eleve.nom || ""} ${eleve.prenom || ""}`.trim(), matiere: mat, type: grilleType, periode: grillePeriode, note: Number(val), annee: annee || getAnnee() }); }
      nb++;
    }
    setGrilleChanges({});
    setGrilleSaving(false);
    toast(`${nb} note(s) enregistrée(s)`, "success");
  };

  return (
    <div>
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
        {Object.keys(grilleChanges).length > 0 && (
          <Btn v="vert" sm disabled={grilleSaving} onClick={sauvegarderGrille}>
            {grilleSaving ? "Enregistrement…" : `💾 Enregistrer (${Object.keys(grilleChanges).length} modif.)`}
          </Btn>
        )}
        {Object.keys(grilleChanges).length > 0 && (
          <Btn v="ghost" sm onClick={() => setGrilleChanges({})}>✕ Annuler</Btn>
        )}
      </div>
      {elevesGrille.length === 0 ? <Vide icone="📝" msg="Aucun élève" /> :
        matieresCols.length === 0 ? <Vide icone="📚" msg="Aucune matière définie" /> :
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 360px)", minHeight: 280, border: "1px solid var(--lc-border)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 150, background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))", position: "sticky", top: 0, left: 0, zIndex: 4 }}>Élève</th>
                  {matieresCols.map(m => (
                    <th key={m} style={{ padding: "8px 10px", textAlign: "center", color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", borderLeft: "1px solid rgba(255,255,255,0.1)", background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))", position: "sticky", top: 0, zIndex: 3 }}>
                      {m}<div style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>/{maxNote}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {elevesGrille.map((e, ri) => {
                  const moy = matieresCols.reduce((s, m) => {
                    const v = Number(valeurCellule(e, m));
                    return s + (isNaN(v) ? 0 : v);
                  }, 0) / matieresCols.filter(m => valeurCellule(e, m) !== "").length || 0;
                  const rowBg = ri % 2 === 0 ? "#fff" : "#f8fafc";
                  return (
                    <tr key={e._id} style={{ background: rowBg, borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.blueDark, whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: rowBg, boxShadow: "inset -1px 0 0 var(--lc-border-soft)" }}>
                        {e.nom} {e.prenom}
                        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>{e.classe}</span>
                        {!isNaN(moy) && moy > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 900, ...couleurNote(moy, maxNote) }}>{moy.toFixed(1)}</span>}
                      </td>
                      {matieresCols.map(m => {
                        const key = `${e._id}|${m}`;
                        const val = valeurCellule(e, m);
                        const modif = key in grilleChanges;
                        return (
                          <td key={m} style={{ padding: "4px 6px", textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                            {canCreate
                              ? <input
                                type="number" min="0" max={maxNote} step="0.25"
                                value={val}
                                onChange={ev => setGrilleChanges(p => ({ ...p, [key]: ev.target.value }))}
                                style={{
                                  width: 54, textAlign: "center", border: `1.5px solid ${modif ? "#f59e0b" : "#e2e8f0"}`,
                                  borderRadius: 6, padding: "3px 4px", fontSize: 12, fontWeight: 700,
                                  outline: "none", ...couleurNote(val, maxNote),
                                  background: modif ? "#fffbeb" : couleurNote(val, maxNote).background || "#fff",
                                }}
                              />
                              : <span style={{ ...couleurNote(val, maxNote), padding: "2px 6px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{val || "—"}</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
    </div>
  );
}
