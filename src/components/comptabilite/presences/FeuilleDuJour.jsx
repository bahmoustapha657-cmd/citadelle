import React, { useState } from "react";
import { C } from "../../../constants";
import { Btn, Input, Modale } from "../../ui";
import { faitExistant } from "./presences-utils";

const CHOIX = [
  { id: "present", label: "Présent", couleur: C.greenDk, fond: "#dcfce7" },
  { id: "absence", label: "Absent", couleur: "#b91c1c", fond: "#fee2e2" },
  { id: "retard", label: "Retard", couleur: "#b45309", fond: "#fef3c7" },
];

// Feuille de présence d'une journée : tout le personnel, présent par défaut ;
// on ne coche que les absents et les retards. Chaque absent / retard devient
// un fait « en attente » de décision ; refaire la feuille ne crée pas de
// doublon (un fait déjà saisi pour l'agent, la date et le type est gardé).
export function FeuilleDuJour({ agents, presences, dateInitiale, fermer, enregistrer }) {
  const [date, setDate] = useState(dateInitiale);
  const [etat, setEtat] = useState({});
  const [enCours, setEnCours] = useState(false);
  const cle = (a) => `${a.section}|${a.nom}`;
  const deja = (a, type) => Boolean(faitExistant(presences, { nom: a.nom, section: a.section, date, type }));
  const choixDe = (a) => etat[cle(a)] || (deja(a, "absence") ? "absence" : deja(a, "retard") ? "retard" : "present");
  const aCreer = agents.filter((a) => choixDe(a) !== "present" && !deja(a, choixDe(a)));
  const sections = [...new Set(agents.map((a) => a.section))];

  const valider = async () => {
    setEnCours(true);
    try { await enregistrer(date, aCreer.map((a) => ({ ...a, type: choixDe(a) }))); } finally { setEnCours(false); }
  };

  return (
    <Modale titre="📋 Feuille de présence du jour" fermer={fermer} large>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ width: 180 }}><Input label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setEtat({}); }} /></div>
        <div style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
          Tout le monde est <strong>présent</strong> par défaut : cochez seulement les absents et les retards.
        </div>
      </div>
      {agents.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>Aucun agent en fiche (onglets Enseignants et Personnel).</div>}
      <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {sections.map((section) => (
          <div key={section} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: ".05em", margin: "6px 0" }}>{section}</div>
            {agents.filter((a) => a.section === section).map((a) => (
              <div key={cle(a)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderBottom: "1px solid var(--lc-border-soft)", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600 }}>{a.nom}</span>
                {CHOIX.map((ch) => {
                  const actif = choixDe(a) === ch.id;
                  const verrou = ch.id !== "present" && deja(a, ch.id);
                  return (
                    <button key={ch.id} type="button" disabled={verrou}
                      title={verrou ? "Déjà saisi pour cette date" : ""}
                      onClick={() => setEtat((p) => ({ ...p, [cle(a)]: ch.id }))}
                      style={{
                        border: `1.5px solid ${actif ? ch.couleur : "var(--lc-border)"}`, background: actif ? ch.fond : "transparent",
                        color: actif ? ch.couleur : "#64748b", borderRadius: 16, padding: "3px 11px", fontSize: 12, fontWeight: 700,
                        cursor: verrou ? "default" : "pointer",
                      }}>{ch.label}{verrou ? " ✓" : ""}</button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{aCreer.length} absence(s)/retard(s) à enregistrer</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={fermer}>Fermer</Btn>
          <Btn disabled={!date || aCreer.length === 0 || enCours} onClick={valider}>{enCours ? "Enregistrement…" : "Enregistrer la feuille"}</Btn>
        </div>
      </div>
    </Modale>
  );
}
