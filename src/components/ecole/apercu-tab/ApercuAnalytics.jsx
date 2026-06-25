import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { C } from "../../../constants";
import { Card, Stat } from "../../ui";
import {
  statsGroupe, statsParClasse, moyenneParMatiere, evolutionMoyenne, statsGenre,
} from "./analytics";

// Tableau de bord analytique (direction) : indicateurs de réussite par classe,
// matière, période et genre. Calculs cohérents avec les bulletins (module
// ./analytics). Une période est sélectionnable ; l'évolution couvre toutes les
// périodes.
export function ApercuAnalytics({ classes, eleves, notes, matieresForClasse, periodes = [], maxNote = 20, couleur }) {
  const seuil = maxNote / 2;
  const elevesActifs = useMemo(() => eleves.filter((e) => e.statut !== "Inactif"), [eleves]);
  const [periode, setPeriode] = useState(periodes[0] || "");

  const ecole = useMemo(() => statsGroupe(elevesActifs, notes, matieresForClasse, periode, seuil), [elevesActifs, notes, matieresForClasse, periode, seuil]);
  const parClasse = useMemo(() => statsParClasse(classes, elevesActifs, notes, matieresForClasse, periode, seuil), [classes, elevesActifs, notes, matieresForClasse, periode, seuil]);
  const parMatiere = useMemo(() => moyenneParMatiere(elevesActifs, notes, matieresForClasse, periode), [elevesActifs, notes, matieresForClasse, periode]);
  const evolution = useMemo(() => evolutionMoyenne(elevesActifs, notes, matieresForClasse, periodes, seuil), [elevesActifs, notes, matieresForClasse, periodes, seuil]);
  const genre = useMemo(() => statsGenre(elevesActifs, notes, matieresForClasse, periode, seuil), [elevesActifs, notes, matieresForClasse, periode, seuil]);

  if (classes.length === 0) return null;

  const fmt = (v) => (v == null ? "—" : Number(v).toFixed(2));
  const couleurTaux = (t) => (t >= 75 ? "#16a34a" : t >= 50 ? "#f59e0b" : "#dc2626");
  const tauxClasseData = parClasse.map((c) => ({ classe: c.classe, Taux: Number(c.taux.toFixed(1)) }));
  const matiereData = parMatiere.map((m) => ({ matiere: m.matiere, Moyenne: Number(m.moyenne.toFixed(2)) }));
  const evoData = evolution.map((p) => ({ periode: p.periode, Moyenne: p.moyenne == null ? null : Number(p.moyenne.toFixed(2)), Taux: Number(p.taux.toFixed(1)) }));

  const titre = { margin: "0 0 12px", fontWeight: 800, fontSize: 13, color: C.blueDark };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: C.blueDark, flex: 1 }}>📊 Tableau de bord analytique</h3>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff" }}>
          {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="Élèves évalués" value={ecole.evalues} sub={`/ ${elevesActifs.length}`} />
        <Stat label="Moyenne école" value={`${fmt(ecole.moyenne)}/${maxNote}`} bg="#eaf4e0" />
        <Stat label="Taux de réussite" value={`${ecole.taux.toFixed(0)}%`} sub={`${ecole.admis} admis`} bg={ecole.taux >= 50 ? "#eaf4e0" : "#fde8e8"} />
        <Stat label="Filles évaluées" value={`${genre.filles.taux.toFixed(0)}%`} sub={`${genre.filles.evalues} · moy ${fmt(genre.filles.moyenne)}`} bg="#fdf2f8" />
        <Stat label="Garçons évalués" value={`${genre.garcons.taux.toFixed(0)}%`} sub={`${genre.garcons.evalues} · moy ${fmt(genre.garcons.moyenne)}`} bg="#eff6ff" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <Card><div style={{ padding: "14px 16px" }}>
          <p style={titre}>Taux de réussite par classe (%)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tauxClasseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="classe" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="Taux" radius={[4, 4, 0, 0]}>
                {tauxClasseData.map((d) => <Cell key={d.classe} fill={couleurTaux(d.Taux)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div></Card>

        <Card><div style={{ padding: "14px 16px" }}>
          <p style={titre}>Évolution de l'école par période</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={evoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="periode" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="moy" domain={[0, maxNote]} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="taux" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="moy" type="monotone" dataKey="Moyenne" stroke={couleur || C.blue} strokeWidth={2} connectNulls />
              <Line yAxisId="taux" type="monotone" dataKey="Taux" stroke="#16a34a" strokeWidth={2} strokeDasharray="4 2" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div></Card>
      </div>

      <Card><div style={{ padding: "14px 16px" }}>
        <p style={titre}>Moyenne par matière — {periode || "toutes périodes"} <small style={{ fontWeight: "normal", color: "#94a3b8" }}>(les dernières = matières en difficulté)</small></p>
        {matiereData.length === 0 ? (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Aucune note saisie pour cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, matiereData.length * 28)}>
            <BarChart data={matiereData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis type="number" domain={[0, maxNote]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="matiere" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v}/${maxNote}`} />
              <Bar dataKey="Moyenne" radius={[0, 4, 4, 0]}>
                {matiereData.map((d) => <Cell key={d.matiere} fill={d.Moyenne >= seuil ? "#16a34a" : "#dc2626"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div></Card>
    </div>
  );
}
