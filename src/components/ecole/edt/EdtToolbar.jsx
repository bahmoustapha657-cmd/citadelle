import { useTranslation } from "react-i18next";
import { C } from "../../../constants";
import { Btn } from "../../ui";
import { imprimerEDT } from "./edt-print";

// Barre d'outils de l'emploi du temps : sélection classe, bascule grille/liste,
// durée des tranches, plage horaire, copie, impression et EDT général.
export function EdtToolbar({ h, maxNote, canCreate, setFiltreClasse, setEdtDuree, edtDuree }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      <strong style={{ fontSize: 14, color: C.blueDark, marginRight: 4 }}>{t("school.timetable.title")}</strong>
      <select value={h.classeEdtActuelle} onChange={e => setFiltreClasse(e.target.value)}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 12px", fontSize: 13, background: "#fff", fontWeight: 700, color: C.blueDark }}>
        {h.classesTriees.map(c => <option key={c._id} value={c.nom}>{c.nom}</option>)}
      </select>
      <Btn sm v={h.edtVueGrille ? "blue" : "ghost"} onClick={() => h.setEdtVueGrille(true)}>📅 Grille</Btn>
      <Btn sm v={!h.edtVueGrille ? "blue" : "ghost"} onClick={() => h.setEdtVueGrille(false)}>☰ Liste</Btn>
      {maxNote === 10
        ? <select value={edtDuree} onChange={e => setEdtDuree(Number(e.target.value))}
            title="Durée des rubriques"
            style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "5px 10px", fontSize: 12, background: "#fff", color: C.blueDark }}>
            <option value={30}>Rubriques 30 min</option>
            <option value={45}>Rubriques 45 min</option>
            <option value={60}>Rubriques 1 h</option>
          </select>
        : <span style={{ fontSize: 11, color: "#9ca3af", padding: "4px 8px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>⏱ Séances 2h</span>
      }
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.blueDark }}>
        De <input type="time" value={h.edtHeureDebut} onChange={e => h.setEdtHeureDebut(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 6, padding: "4px 6px", fontSize: 12, width: 90 }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.blueDark }}>
        à <input type="time" value={h.edtHeureFin} onChange={e => h.setEdtHeureFin(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 6, padding: "4px 6px", fontSize: 12, width: 90 }} />
      </label>
      {canCreate && <Btn sm v="vert" onClick={h.copierEDT}>📋 Copier vers…</Btn>}
      {h.classeEdtActuelle !== "all" && <Btn sm v="ghost" onClick={() => imprimerEDT({ emploisClasse: h.emploisClasse, TRANCHES: h.TRANCHES, classeEdtActuelle: h.classeEdtActuelle, schoolInfo: h.schoolInfo, findEns: h.findEns })}>🖨️ Imprimer</Btn>}
      <Btn sm v="blue" onClick={() => h.setEdtGeneralOuvert(true)}>📊 EDT Général</Btn>
    </div>
  );
}
