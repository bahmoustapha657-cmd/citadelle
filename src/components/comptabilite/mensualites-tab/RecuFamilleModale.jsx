import { useState } from "react";
import { C, fmt } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { getEleveSolde } from "../../../mensualite-utils";
import { FORMATS_RECU, getRecuFormat, setRecuFormat } from "./recu-format";
import { imprimerRecuFamilleEleves } from "./recu-eleve";

// ══════════════════════════════════════════════════════════════
//  Reçu famille — un reçu pour plusieurs enfants d'un même tuteur
// ══════════════════════════════════════════════════════════════
// `fratrie` : l'élève cliqué puis ses frères et sœurs, toutes sections
// confondues (cf. fratrie.js). Tous sont cochés ; le caissier décoche ceux
// que le parent ne règle pas aujourd'hui.
export function RecuFamilleModale({ fratrie = [], moisAnnee, annee, tarifsClasses, schoolInfo, fermer }) {
  const [coches, setCoches] = useState(() => new Set(fratrie.map((e) => e._id)));
  const [format, setFormat] = useState(getRecuFormat);
  const choisis = fratrie.filter((e) => coches.has(e._id));
  const basculer = (id) => setCoches((avant) => {
    const apres = new Set(avant);
    if (apres.has(id)) apres.delete(id); else apres.add(id);
    return apres;
  });
  const imprimer = () => {
    if (!choisis.length) return;
    setRecuFormat(format);
    imprimerRecuFamilleEleves({ eleves: choisis, tarifsClasses, moisAnnee, annee, schoolInfo, format });
  };
  const tuteur = fratrie[0]?.tuteur || "—";

  return (
    <Modale titre={`👨‍👩‍👧 Reçu famille — ${tuteur}`} fermer={fermer}>
      <div style={{ textAlign: "start" }}>
        <p style={{ fontSize: 12.5, color: "#475569", margin: "0 0 10px" }}>
          Enfants rattachés à ce tuteur (même nom et même numéro, ou même filiation).
          Décochez ceux à ne pas faire figurer sur le reçu.
        </p>
        {fratrie.map((e) => {
          const reste = getEleveSolde(e, moisAnnee, tarifsClasses, annee);
          return (
            <label key={e._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8,
              border: "1px solid var(--lc-border, #e2e8f0)", marginBottom: 6, cursor: "pointer",
              background: coches.has(e._id) ? "#f0f9ff" : "transparent" }}>
              <input type="checkbox" checked={coches.has(e._id)} onChange={() => basculer(e._id)} />
              <span style={{ flex: 1, fontSize: 13 }}>
                <strong>{e.nom} {e.prenom}</strong>
                <span style={{ color: "#64748b" }}> · {e.classe}{e.matricule ? ` · ${e.matricule}` : ""}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: reste > 0 ? "#b91c1c" : C.greenDk }}>
                {reste > 0 ? `reste ${fmt(reste)}` : "à jour"}
              </span>
            </label>
          );
        })}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
          {FORMATS_RECU.map((f) => (
            <button key={f.id} onClick={() => setFormat(f.id)} title={f.aide}
              style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: `1px solid ${f.id === format ? "#f59e0b" : "#cbd5e1"}`,
                background: f.id === format ? "#fef3c7" : "var(--lc-surface, #fff)", color: "#334155" }}>
              {f.icone} {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn sm v="ghost" onClick={fermer}>Fermer</Btn>
          <Btn sm v="amber" onClick={imprimer} disabled={!choisis.length}>
            🖨️ Imprimer ({choisis.length} enfant{choisis.length > 1 ? "s" : ""})
          </Btn>
        </div>
      </div>
    </Modale>
  );
}
