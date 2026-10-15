import { useState } from "react";
import { fmtN } from "../../../constants";
import { imprimerPreavisRenvoi } from "../../../reports";
import {
  PREAVIS_PAR_PAGE, PREAVIS_PAR_PAGE_DEFAUT, dateIso, dateLimiteParDefaut,
} from "../../../reports/preavis-renvoi";
import { Btn, Input, Modale } from "../../ui";
import { FORMATS_RECU, getRecuFormat } from "./recu-format";

// Nombre de préavis par page A4 : préférence de l'APPAREIL (comme le format
// des reçus), gardée d'une impression à l'autre.
const CLE_PAR_PAGE = "LC_preavisParPage";
const lireParPage = () => {
  try {
    const n = Number(localStorage.getItem(CLE_PAR_PAGE));
    return PREAVIS_PAR_PAGE.includes(n) ? n : PREAVIS_PAR_PAGE_DEFAUT;
  } catch { return PREAVIS_PAR_PAGE_DEFAUT; }
};
const garderParPage = (n) => {
  try { localStorage.setItem(CLE_PAR_PAGE, String(n)); } catch { /* mode privé : défaut */ }
};

// Préavis de renvoi pour les élèves en retard (`retards`, issus de
// l'alerte) : date limite de règlement choisie à l'impression, support de
// l'appareil (comme les reçus) modifiable pour cette impression seulement.
export function PreavisModale({ retards, schoolInfo, annee, monnaie, fermer }) {
  const [dateLimite, setDateLimite] = useState(() => dateLimiteParDefaut());
  const [format, setFormat] = useState(getRecuFormat);
  const [parPage, setParPage] = useState(lireParPage);
  const valide = /^\d{4}-\d{2}-\d{2}$/.test(dateLimite) && dateLimite >= dateIso(new Date());
  const total = retards.reduce((s, r) => s + r.montant, 0);
  const seul = retards.length === 1 ? retards[0].eleve : null;

  return (
    <Modale titre="📨 Préavis de renvoi" fermer={fermer}>
      <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
        {seul
          ? <>Préavis pour <strong>{seul.nom} {seul.prenom}</strong> ({seul.classe})</>
          : <><strong>{retards.length} préavis</strong> — un par élève en retard de la liste</>}
        {total > 0 && <> · reste dû : <strong>{fmtN(total)} {monnaie}</strong></>}
      </div>
      <Input label="Date limite de règlement avant renvoi" type="date" min={dateIso(new Date())}
        value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
      {!valide && <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 4 }}>Choisissez une date à partir d'aujourd'hui.</div>}
      <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>Support</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FORMATS_RECU.map((f) => (
          <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "5px 10px", cursor: "pointer",
            border: `1px solid ${format === f.id ? "#1d4ed8" : "var(--lc-border, #cbd5e1)"}`, borderRadius: 8 }}>
            <input type="radio" name="format-preavis" checked={format === f.id} onChange={() => setFormat(f.id)} />
            {f.icone} {f.id === "a4" ? "A4 à découper" : f.label}
          </label>
        ))}
      </div>
      {format === "a4" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
          <span style={{ fontWeight: 700 }}>Préavis par page :</span>
          {PREAVIS_PAR_PAGE.map((n) => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", cursor: "pointer",
              border: `1px solid ${parPage === n ? "#1d4ed8" : "var(--lc-border, #cbd5e1)"}`, borderRadius: 8 }}>
              <input type="radio" name="par-page-preavis" checked={parPage === n} onChange={() => setParPage(n)} />
              {n}{n === 4 ? " (2 × 2)" : ""}
            </label>
          ))}
          <span style={{ color: "#64748b" }}>· {Math.ceil(retards.length / parPage)} page(s)</span>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
        Chaque préavis porte un talon à découper, que le parent signe et que l'élève rapporte.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={!valide} onClick={() => {
          garderParPage(parPage);
          imprimerPreavisRenvoi(retards, { schoolInfo, annee, dateLimite, format, parPage });
          fermer();
        }}>🖨️ Imprimer {retards.length > 1 ? `${retards.length} préavis` : "le préavis"}</Btn>
      </div>
    </Modale>
  );
}
