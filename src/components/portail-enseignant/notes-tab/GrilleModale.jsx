import { useState } from "react";
import { C } from "../../../constants";
import { Btn, Modale, Selec, Vide } from "../../ui";

// Modale de saisie en grille (portail enseignant). Trois modes :
//  - normal        : une période + une matière figées, une colonne « Note ».
//  - multipériode  : colonnes = périodes (saisir les 2-3 compositions d'un coup).
//  - multi-matières: colonnes = matières de la classe (titulaire du primaire) →
//                    saisir toutes les matières d'un élève puis enregistrer une
//                    seule fois. Recherche d'élève par nom dans tous les modes.
export function GrilleModale({
  matiere, mesClasses, noteForms, periodes,
  isPrimaire = false, matieresDispo = [],
  gridForm, setGridForm, majGrid, portalData,
  gridProgress, enregistrement, setModalNote, enregistrerGrille,
}) {
  const [rech, setRech] = useState("");
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const multi = !!gridForm.multiPeriode;
  const multiMat = !!gridForm.multiMatiere;
  const maxNote = isPrimaire ? 10 : 20;
  const matCols = matieresDispo.map((m) => m.nom).filter(Boolean);

  const elevesClasse = (portalData.eleves || []).filter((e) => e.classe === gridForm.classe);
  const elevesAff = rech.trim()
    ? elevesClasse.filter((e) => norm(`${e.nom} ${e.prenom}`).includes(norm(rech)) || norm(`${e.prenom} ${e.nom}`).includes(norm(rech)))
    : elevesClasse;
  const combine = multi && multiMat;
  // Descripteurs de colonnes : { sub, label, group }. sub = suffixe de clé
  // (null = colonne unique). group = en-tête de regroupement (mode combiné).
  const colDefs = combine
    ? periodes.flatMap((p) => matCols.map((m) => ({ sub: `${p}|${m}`, label: m, group: p })))
    : multi ? periodes.map((p) => ({ sub: p, label: p, group: null }))
      : multiMat ? matCols.map((m) => ({ sub: m, label: m, group: null }))
        : [{ sub: null, label: "Note", group: null }];
  const enColonnes = multi || multiMat;
  const cle = (eleveId, sub) => (sub == null ? eleveId : `${eleveId}|${sub}`);
  const remplies = Object.values(gridForm.notes).filter((v) => v !== "" && v != null).length;

  const titreMatiere = combine ? "Toutes périodes × matières"
    : multiMat ? "Toutes les matières"
      : isPrimaire ? (gridForm.matiere || "Matière") : (matiere || "Matière");

  return (
    <Modale xlarge titre={`Saisie en grille — ${titreMatiere}`} fermer={() => setModalNote(null)}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <Selec label="Classe" value={gridForm.classe} onChange={(e) => majGrid({ classe: e.target.value })}>
          {mesClasses.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
        </Selec>
        {isPrimaire && !multiMat && (
          <Selec label="Matière" value={gridForm.matiere || ""} onChange={(e) => majGrid({ matiere: e.target.value })}>
            <option value="">— Matière —</option>
            {matieresDispo.map((m) => <option key={m._id || m.nom} value={m.nom}>{m.nom}</option>)}
          </Selec>
        )}
        <Selec label="Type d'évaluation" value={gridForm.type} onChange={(e) => majGrid({ type: e.target.value })}>
          {noteForms.map((item) => <option key={item.id} value={item.value}>{item.label}</option>)}
        </Selec>
        {!multi && (
          <Selec label="Période" value={gridForm.periode} onChange={(e) => majGrid({ periode: e.target.value })}>
            {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </Selec>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={rech} onChange={(e) => setRech(e.target.value)}
          placeholder="🔍 Rechercher un élève…"
          style={{ flex: 1, minWidth: 180, border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer", border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", background: multi ? "#e0ebf8" : "#fff" }}>
          <input type="checkbox" checked={multi} onChange={(e) => majGrid({ multiPeriode: e.target.checked })} />
          🗓️ Toutes les périodes
        </label>
        {isPrimaire && matCols.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer", border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", background: multiMat ? "#dcfce7" : "#fff" }}>
            <input type="checkbox" checked={multiMat} onChange={(e) => majGrid({ multiMatiere: e.target.checked })} />
            📚 Toutes les matières
          </label>
        )}
      </div>

      {elevesClasse.length === 0 ? <Vide icone="👥" msg="Aucun élève dans cette classe." /> : (
        <>
          <div style={{ padding: "8px 12px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af", marginBottom: 10 }}>
            <strong>{remplies}</strong> note(s) saisie(s). Les notes existantes sont préremplies — modifier/effacer met à jour ou laisse en l'état.
          </div>
          <div style={{ maxHeight: "52vh", overflowY: "auto", overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table className="lc-sticky-table" data-fix-left="1">
              <thead style={{ background: "#0A1628", color: "#fff" }}>
                {combine ? (
                  <>
                    <tr>
                      <th rowSpan={2} style={{ padding: "8px 10px", fontSize: 11, textAlign: "start", width: 50 }}>#</th>
                      <th rowSpan={2} style={{ padding: "8px 10px", fontSize: 11, textAlign: "start" }}>Élève</th>
                      {periodes.map((p) => (
                        <th key={p} colSpan={matCols.length} style={{ padding: "6px 10px", fontSize: 11, textAlign: "center", borderInlineStart: "2px solid #334155" }}>{p}</th>
                      ))}
                    </tr>
                    <tr>
                      {periodes.map((p) => matCols.map((m, idx) => (
                        <th key={`${p}|${m}`} style={{ padding: "6px 8px", fontSize: 10, textAlign: "center", width: 84, borderInlineStart: idx === 0 ? "2px solid #334155" : undefined }}>{m}<br/><small style={{ fontWeight: "normal" }}>/{maxNote}</small></th>
                      )))}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th style={{ padding: "8px 10px", fontSize: 11, textAlign: "start", width: 50 }}>#</th>
                    <th style={{ padding: "8px 10px", fontSize: 11, textAlign: "start" }}>Élève</th>
                    {colDefs.map((d) => (
                      <th key={d.sub || "note"} style={{ padding: "8px 10px", fontSize: 11, textAlign: "center", width: enColonnes ? 100 : 110 }}>
                        {d.label} /{maxNote}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {elevesAff.map((e, i) => (
                  <tr key={e._id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={{ padding: "6px 10px", fontSize: 11, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ padding: "6px 10px", fontSize: 13 }}>
                      <strong>{e.nom} {e.prenom}</strong>
                      {e.matricule && <span style={{ marginInlineStart: 6, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{e.matricule}</span>}
                    </td>
                    {colDefs.map((d) => {
                      const key = cle(e._id, d.sub);
                      const val = gridForm.notes[key] ?? "";
                      const num = val === "" ? null : Number(val);
                      const invalid = val !== "" && (Number.isNaN(num) || num < 0 || num > maxNote);
                      return (
                        <td key={d.sub || "note"} style={{ padding: "6px 8px", textAlign: "center" }}>
                          <input
                            type="number" min={0} max={maxNote} step={0.25} value={val}
                            onChange={(ev) => setGridForm((g) => ({ ...g, notes: { ...g.notes, [key]: ev.target.value } }))}
                            style={{
                              width: 76, padding: "6px 8px",
                              border: `1.5px solid ${invalid ? "#ef4444" : (val !== "" ? C.green : "#e2e8f0")}`,
                              borderRadius: 6, fontSize: 13, textAlign: "center",
                              background: invalid ? "#fef2f2" : "#fff", outline: "none",
                            }}
                            placeholder="—"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {gridProgress.total > 0 && enregistrement && `Enregistrement ${gridProgress.done}/${gridProgress.total}…`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={() => setModalNote(null)} disabled={enregistrement}>Fermer</Btn>
          <Btn v="vert" onClick={enregistrerGrille} disabled={enregistrement}>
            {enregistrement ? "Enregistrement…" : "💾 Enregistrer la grille"}
          </Btn>
        </div>
      </div>
    </Modale>
  );
}
