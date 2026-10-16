import { useMemo, useState } from "react";
import { Card, Vide } from "../ui";
import {
  normaliserCreneau, joursAffiches, jourCourant, creneauxDuJour, tranchesPortail,
  planifierJour, palettePour, libellesCreneau, horaire,
} from "../../edt-portail";

// Emploi du temps en lecture (portails enseignant et parent).
//  - « Semaine » : grille horaires × jours, chaque créneau couvre autant de
//    lignes que sa durée (rowSpan), comme la grille de saisie de l'école ;
//  - « Jour »    : une journée à la fois, en cartes — la vue des téléphones,
//    où six colonnes ne tiennent pas.
// `mode` : "enseignant" (case = classe + matière, couleur par classe) ou
// "parent" (case = matière + enseignant, couleur par matière).
const ecranEtroit = () => typeof window !== "undefined" && window.innerWidth < 720;

export function EdtSemaine({ emplois: brut, joursOuvrables, mode = "parent", matiereParDefaut = "", c1 = "#0A1628" }) {
  const emplois = useMemo(() => brut.map(normaliserCreneau), [brut]);
  const jours = useMemo(() => joursAffiches(emplois, joursOuvrables), [emplois, joursOuvrables]);
  const couleur = useMemo(() => palettePour(emplois, mode === "enseignant" ? "classe" : "matiere"), [emplois, mode]);
  const aujourdhui = jourCourant();

  const [vue, setVue] = useState(ecranEtroit() ? "jour" : "semaine");
  const [jourChoisi, setJourChoisi] = useState(() => {
    if (aujourdhui && jours.includes(aujourdhui)) return aujourdhui;
    return jours.find((j) => emplois.some((c) => c.jour === j)) || jours[0];
  });

  if (!emplois.length) {
    return <Vide icone="🗓️" msg={mode === "enseignant" ? "Aucun créneau dans votre emploi du temps pour l'instant" : "L'emploi du temps de la classe n'est pas encore publié"} />;
  }

  const bouton = (actif) => ({
    border: "none", cursor: "pointer", padding: "7px 14px", fontSize: 12, fontWeight: 800, borderRadius: 8,
    background: actif ? "#fff" : "transparent", color: actif ? c1 : "#64748b",
    boxShadow: actif ? "0 1px 3px rgba(15,23,42,.15)" : "none",
  });

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 2, background: "#eef2f7", padding: 3, borderRadius: 10, marginBottom: 14 }}>
        <button type="button" style={bouton(vue === "semaine")} onClick={() => setVue("semaine")}>Semaine</button>
        <button type="button" style={bouton(vue === "jour")} onClick={() => setVue("jour")}>Par jour</button>
      </div>
      {vue === "semaine"
        ? <GrilleSemaine emplois={emplois} jours={jours} couleur={couleur} mode={mode} matiereParDefaut={matiereParDefaut} aujourdhui={aujourdhui} c1={c1} />
        : <VueJour emplois={emplois} jours={jours} jour={jourChoisi} setJour={setJourChoisi} couleur={couleur} mode={mode} matiereParDefaut={matiereParDefaut} aujourdhui={aujourdhui} c1={c1} />}
    </div>
  );
}

function GrilleSemaine({ emplois, jours, couleur, mode, matiereParDefaut, aujourdhui, c1 }) {
  const tranches = tranchesPortail(emplois);
  const plans = Object.fromEntries(jours.map((j) => [j, planifierJour(creneauxDuJour(emplois, j), tranches)]));
  const entete = { background: c1, color: "#fff", padding: "10px 8px", fontSize: 12, fontWeight: 800, textAlign: "center" };
  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 120 + jours.length * 110, tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 78 }} />{jours.map((j) => <col key={j} />)}</colgroup>
          <thead>
            <tr>
              <th style={{ ...entete, borderTopLeftRadius: 10 }}>Heure</th>
              {jours.map((j, k) => (
                <th key={j} style={{ ...entete, borderTopRightRadius: k === jours.length - 1 ? 10 : 0, boxShadow: j === aujourdhui ? "inset 0 -3px 0 #fbbf24" : "none" }}>
                  {j}{j === aujourdhui && <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>aujourd'hui</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tranches.slice(0, -1).map((hd, i) => (
              <tr key={hd}>
                <td style={{ padding: "8px 6px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{hd}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{tranches[i + 1]}</div>
                </td>
                {jours.map((jour) => {
                  const { debuts, occupees } = plans[jour];
                  if (occupees.has(i)) return null;
                  const debut = debuts.get(i);
                  const fondJour = jour === aujourdhui ? "#fffbeb" : "#fff";
                  if (!debut) return <td key={jour} style={{ background: fondJour, borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9" }} />;
                  return (
                    <td key={jour} rowSpan={debut.span} style={{ background: fondJour, padding: 4, borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", verticalAlign: "top", height: 1 }}>
                      <CaseCreneau c={debut.creneau} couleur={couleur(debut.creneau)} mode={mode} matiereParDefaut={matiereParDefaut} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CaseCreneau({ c, couleur, mode, matiereParDefaut }) {
  const { titre, detail } = libellesCreneau(c, mode, matiereParDefaut);
  const recre = c.type === "recreation";
  return (
    <div style={{
      height: "100%", minHeight: 44, boxSizing: "border-box", background: couleur.fond, borderLeft: `4px solid ${couleur.trait}`,
      borderRadius: 8, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2,
      justifyContent: recre ? "center" : "flex-start", textAlign: recre ? "center" : "start",
    }}>
      {c.type === "revision" && <span style={{ alignSelf: "flex-start", background: couleur.trait, color: "#fff", fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 4 }}>RÉVISION</span>}
      <div style={{ fontSize: 12, fontWeight: 900, color: couleur.texte, lineHeight: 1.25, overflowWrap: "anywhere" }}>{recre ? `🍎 ${titre}` : titre}</div>
      {detail && <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.25, overflowWrap: "anywhere" }}>{detail}</div>}
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{horaire(c)}</div>
      {c.salle && <div style={{ fontSize: 10, color: "#64748b" }}>📍 {c.salle}</div>}
    </div>
  );
}

function VueJour({ emplois, jours, jour, setJour, couleur, mode, matiereParDefaut, aujourdhui, c1 }) {
  const duJour = creneauxDuJour(emplois, jour);
  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
        {jours.map((j) => {
          const actif = j === jour;
          const nb = emplois.filter((c) => c.jour === j && c.type !== "recreation").length;
          return (
            <button key={j} type="button" onClick={() => setJour(j)} style={{
              flex: "0 0 auto", minWidth: 62, border: `2px solid ${actif ? c1 : "#e2e8f0"}`, borderRadius: 12, cursor: "pointer",
              background: actif ? c1 : "#fff", color: actif ? "#fff" : "#334155", padding: "6px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{j.slice(0, 3)}</div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{j === aujourdhui ? "auj." : `${nb} cours`}</div>
            </button>
          );
        })}
      </div>
      <h3 style={{ margin: "4px 0 10px", fontSize: 14, fontWeight: 900, color: c1 }}>{jour}{jour === aujourdhui ? " — aujourd'hui" : ""}</h3>
      {duJour.length === 0 ? (
        <Card><div style={{ padding: 22, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Pas de cours ce jour-là</div></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {duJour.map((c, k) => {
            const col = couleur(c);
            const { titre, detail } = libellesCreneau(c, mode, matiereParDefaut);
            if (c.type === "recreation") {
              return (
                <div key={c._id || k} style={{ background: col.fond, color: col.texte, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
                  🍎 {titre} · {horaire(c)}
                </div>
              );
            }
            return (
              <div key={c._id || k} style={{ display: "flex", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(15,23,42,.08)", overflow: "hidden", border: "1px solid #eef2f7" }}>
                <div style={{ flex: "0 0 74px", background: col.fond, borderRight: `4px solid ${col.trait}`, padding: "10px 6px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: col.texte }}>{String(c.heureDebut || "").slice(0, 5) || "—"}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{String(c.heureFin || "").slice(0, 5)}</div>
                </div>
                <div style={{ padding: "10px 14px", minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{titre}</span>
                    {c.type === "revision" && <span style={{ background: col.trait, color: "#fff", fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 4 }}>RÉVISION</span>}
                  </div>
                  {detail && <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{detail}</div>}
                  {c.salle && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>📍 Salle {c.salle}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
