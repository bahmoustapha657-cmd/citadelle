import { getAnnee } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { getEvaluationLabel, resolveCanonicalNoteType } from "../../../evaluation-forms";
import { loadXLSX } from "./notes-helpers";

// Modale d'import de notes depuis un fichier Excel/CSV avec prévisualisation
// ligne par ligne et validation avant écriture.
export function ImportNotesModal({
  setModal,
  importPreview, setImportPreview,
  importEnCours, setImportEnCours,
  noteForms, schoolInfo, isPrimarySection, periodes, maxNote, eleves,
  ajN, annee, toast,
}) {
  return (
    <Modale titre="⬆️ Importer des notes depuis Excel" fermer={() => { setModal(null); setImportPreview(null); }} large>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, fontSize: 12, color: "#166534" }}>
        <strong>Format attendu :</strong> colonnes <em>Élève (Nom Prénom) · Matière · Type · Période · Note</em><br />
        Télécharge le modèle via le bouton "📋 Modèle" pour garantir le bon format.
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={async e => {
        const file = e.target.files[0];
        if (!file) return;
        const ab = await file.arrayBuffer();
        const XLSX = await loadXLSX();
        const wb = XLSX.read(ab);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1);
        const lignes = rows.filter(r => r[0] || r[1]).map((r, i) => {
          const eleveNom = String(r[0] || "").trim();
          const matiere = String(r[1] || "").trim();
          const type = resolveCanonicalNoteType(String(r[2] || (noteForms[0]?.label || "Devoir")).trim(), schoolInfo, isPrimarySection ? "primaire" : "secondaire");
          const periode = String(r[3] || periodes[0] || "T1").trim();
          const note = Number(String(r[4] || "").replace(",", "."));
          const eleve = eleves.find(e => `${e.nom} ${e.prenom}`.toLowerCase() === eleveNom.toLowerCase());
          const erreurs = [];
          if (!eleveNom) erreurs.push("Élève manquant");
          else if (!eleve) erreurs.push("Élève introuvable");
          if (!matiere) erreurs.push("Matière manquante");
          if (isNaN(note) || note < 0 || note > maxNote) erreurs.push(`Note invalide (0–${maxNote})`);
          return { eleveNom, eleveId: eleve?._id, matiere, type, periode, note, erreurs, ligne: i + 2 };
        });
        setImportPreview({ lignes, valides: lignes.filter(l => !l.erreurs.length) });
      }} style={{ marginBottom: 12 }} />

      {importPreview && <>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12 }}>
          <span style={{ color: "#059669", fontWeight: 700 }}>✅ {importPreview.valides.length} valides</span>
          <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ {importPreview.lignes.length - importPreview.valides.length} erreurs</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>L.</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>Élève</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>Matière</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>Type</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>Période</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b" }}>Note</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b" }}>Statut</th>
            </tr></thead>
            <tbody>{importPreview.lignes.map((l, i) => (
              <tr key={i} style={{ background: l.erreurs.length ? "#fef2f2" : "#f0fdf4", borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "4px 8px", color: "#94a3b8", fontSize: 10 }}>{l.ligne}</td>
                <td style={{ padding: "4px 8px", fontWeight: 600 }}>{l.eleveNom || "—"}</td>
                <td style={{ padding: "4px 8px" }}>{l.matiere || "—"}</td>
                <td style={{ padding: "4px 8px" }}>{getEvaluationLabel(l.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" })}</td>
                <td style={{ padding: "4px 8px" }}>{l.periode}</td>
                <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700 }}>{isNaN(l.note) ? "—" : l.note}</td>
                <td style={{ padding: "4px 8px" }}>
                  {l.erreurs.length
                    ? <span style={{ color: "#dc2626", fontSize: 10 }}>⚠️ {l.erreurs.join(", ")}</span>
                    : <span style={{ color: "#059669", fontSize: 10 }}>✅</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => { setModal(null); setImportPreview(null); }}>Annuler</Btn>
        {importPreview?.valides.length > 0 && <Btn v="vert" disabled={importEnCours} onClick={async () => {
          setImportEnCours(true);
          let count = 0;
          for (const l of importPreview.valides) {
            await ajN({ eleveNom: l.eleveNom, eleveId: l.eleveId, matiere: l.matiere, type: l.type, periode: l.periode, note: l.note, annee: annee || getAnnee() });
            count++;
          }
          setImportEnCours(false);
          setModal(null);
          setImportPreview(null);
          toast(`${count} note(s) importée(s) avec succès`, "success");
        }}>{importEnCours ? "Import en cours…" : `⬆️ Importer ${importPreview.valides.length} note(s)`}</Btn>}
      </div>
    </Modale>
  );
}
