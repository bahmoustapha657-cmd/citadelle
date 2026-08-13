import { useState } from "react";
import { C, getFraisAnnexeLabel, initMens, isFraisAnnexePaye } from "../../../constants";
import { Badge, Btn, TR, TD } from "../../ui";
import { imprimerRecu, imprimerRecuTicket } from "../../../reports";
import { getEleveMensualiteSnapshot } from "../../../mensualite-utils";
import { FORMATS_RECU, getRecuFormat, labelRecuFormat, setRecuFormat } from "./recu-format";

// Une ligne élève de la grille des mensualités : colonnes figées (matricule,
// nom), bascules mensuelles, frais d'inscription/annexes et impression du reçu.
export function MensualitesRow({
  e, rowIdx, moisAnnee, tarifsClasses, readOnly, canCreate, canEdit, schoolInfo,
  toggleMens, toggleFraisAnnexe, getTarifInscriptionEleve, getTarifAutre, getTarif,
  getTarifFraisDivers,
}) {
  const mens = e.mens || initMens();
  const snapshot = getEleveMensualiteSnapshot(e, moisAnnee, tarifsClasses);
  const montantInscription = getTarifInscriptionEleve(e);
  const montantAutre = getTarifAutre(e.classe);
  // Frais annexes actifs pour la classe : « autre » (legacy) + catalogue.
  const fraisDivers = getTarifFraisDivers ? getTarifFraisDivers(e.classe) : {};
  const fraisActifs = {
    ...(montantAutre > 0 ? { autre: montantAutre } : {}),
    ...fraisDivers,
  };
  const idsFrais = Object.keys(fraisActifs);
  const nbFraisPayes = idsFrais.filter((id) => isFraisAnnexePaye(e, id)).length;
  const [menuFrais, setMenuFrais] = useState(false);
  // Impression du reçu : le 🖨️ imprime aussitôt dans le format retenu sur ce
  // poste (un clic pour le caissier) ; le ▾ permet d'en changer.
  const [menuImpr, setMenuImpr] = useState(false);
  const [formatRecu, setFormatRecu] = useState(getRecuFormat);
  const imprimer = (format) => {
    setMenuImpr(false);
    setFormatRecu(format);
    setRecuFormat(format);
    const frais = { inscription: montantInscription, autre: montantAutre, divers: fraisDivers };
    if (format === "a4") imprimerRecu(e, getTarif(e.classe), schoolInfo, moisAnnee, frais);
    else imprimerRecuTicket(e, getTarif(e.classe), schoolInfo, moisAnnee, frais, Number(format));
  };
  const basculerFrais = (id) => toggleFraisAnnexe(e._id, id === "autre" ? {
    payKey: "autrePayee",
    dateKey: "autreDate",
    valeurActuelle: e.autrePayee,
    label: "Autre frais",
    montant: montantAutre,
    nomEleve: `${e.nom} ${e.prenom}`,
  } : {
    fraisId: id,
    fraisPayesActuels: e.fraisPayes || {},
    valeurActuelle: isFraisAnnexePaye(e, id),
    label: getFraisAnnexeLabel(id),
    montant: fraisActifs[id],
    nomEleve: `${e.nom} ${e.prenom}`,
  });
  // Background explicite sur les cellules sticky : sinon le contenu des colonnes
  // suivantes glisse "derrière" lors du scroll horizontal. Alterné pour le zébrage.
  const stickyBg = rowIdx % 2 === 0 ? "var(--lc-surface)" : "var(--lc-surface-alt, #f8fafc)";
  const tdSticky = (left) => ({
    position: "sticky", left, zIndex: 1, background: stickyBg,
    boxShadow: left > 0 ? "inset -1px 0 0 var(--lc-border-soft)" : undefined,
  });
  return (
    <TR>
      <TD style={tdSticky(0)}><span style={{ fontSize: 11, fontFamily: "monospace", background: "#e0ebf8", padding: "2px 6px", borderRadius: 4, color: C.blue, fontWeight: 700 }}>{e.matricule}</span></TD>
      <TD bold style={tdSticky(95)}>{e.nom} {e.prenom}</TD>
      <TD><Badge color="blue">{e.classe}</Badge></TD>
      <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
      {moisAnnee.map(m => {
        const paye = mens[m] === "Payé";
        const datePaie = (e.mensDates || {})[m] || "";
        const peutCliquer = paye ? (canCreate && canEdit) : canCreate;
        return <td key={m} style={{ padding: "4px 2px", textAlign: "center" }}>
          <button onClick={() => peutCliquer && toggleMens(e._id, m, mens, e.mensDates || {}, `${e.nom} ${e.prenom}`)}
            title={`${m} — ${mens[m] || "Impayé"}${datePaie ? " (" + datePaie + ")" : ""}`}
            style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: peutCliquer ? "pointer" : "default", fontSize: 12,
              background: paye ? C.green : "#e8f0e8", color: paye ? "#fff" : "#9ca3af", fontWeight: 700, opacity: (readOnly || (!peutCliquer && !paye)) ? 0.6 : 1 }}>
            {paye ? "✓" : "·"}
          </button>
        </td>;
      })}
      <td style={{ padding: "4px 8px", textAlign: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: snapshot.nbPayes === moisAnnee.length ? C.greenDk : snapshot.nbPayes > 0 ? "#d97706" : "#b91c1c" }}>
          {snapshot.nbPayes}/{moisAnnee.length}
        </span>
      </td>
      <td style={{ padding: "4px 4px", textAlign: "center" }}>
        <button onClick={() => toggleFraisAnnexe(e._id, {
          payKey: "inscriptionPayee",
          dateKey: "inscriptionDate",
          valeurActuelle: e.inscriptionPayee,
          label: e.typeInscription === "Réinscription" ? "Réinscription" : "Inscription",
          montant: montantInscription,
          nomEleve: `${e.nom} ${e.prenom}`,
        })} title={`${e.typeInscription === "Réinscription" ? "Réinscription" : "Inscription"}${e.inscriptionDate ? ` (${e.inscriptionDate})` : ""}`}
          style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: readOnly ? "default" : "pointer", fontSize: 11,
            background: e.inscriptionPayee ? C.blue : "#f1f3f4", color: e.inscriptionPayee ? "#fff" : "#9ca3af", fontWeight: 700 }}>
          {e.inscriptionPayee ? "✓" : "I"}
        </button>
      </td>
      <td style={{ padding: "4px 4px", textAlign: "center", position: "relative" }}>
        {idsFrais.length === 0 ? (
          <span title="Aucun frais annexe configuré pour cette classe (Tarifs par classe)"
            style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>
        ) : (
          <>
            <button onClick={() => setMenuFrais((v) => !v)}
              title={`Frais annexes : ${nbFraisPayes}/${idsFrais.length} payé(s)`}
              style={{ minWidth: 34, height: 26, borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10,
                background: nbFraisPayes === idsFrais.length ? "#475569" : nbFraisPayes > 0 ? "#f59e0b" : "#f1f3f4",
                color: nbFraisPayes > 0 || nbFraisPayes === idsFrais.length ? "#fff" : "#9ca3af", fontWeight: 700, padding: "0 6px" }}>
              {nbFraisPayes}/{idsFrais.length}
            </button>
            {menuFrais && (
              <div onMouseLeave={() => setMenuFrais(false)}
                style={{ position: "absolute", top: "100%", insetInlineEnd: 0, zIndex: 20, minWidth: 230,
                  background: "var(--lc-surface, #fff)", border: "1px solid #cbd5e1", borderRadius: 10,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.18)", padding: 8, textAlign: "start" }}>
                {idsFrais.map((id) => {
                  const paye = isFraisAnnexePaye(e, id);
                  return (
                    <button key={id} onClick={() => { setMenuFrais(false); basculerFrais(id); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
                        border: "none", background: "none", cursor: readOnly ? "default" : "pointer",
                        padding: "6px 8px", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                      <span style={{ fontWeight: 600 }}>{getFraisAnnexeLabel(id)}</span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: paye ? "#059669" : "#94a3b8" }}>
                        {Number(fraisActifs[id]).toLocaleString("fr-FR")} {paye ? "✓" : "·"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </td>
      <td style={{ padding: "4px 6px", textAlign: "center", position: "relative", whiteSpace: "nowrap" }}>
        <Btn sm v="amber" title={`Imprimer le reçu — ${labelRecuFormat(formatRecu)}`}
          onClick={() => imprimer(formatRecu)}>🖨️</Btn>
        <button onClick={() => setMenuImpr((v) => !v)} title="Choisir le format d'impression"
          style={{ marginInlineStart: 3, width: 20, height: 24, borderRadius: 6, border: "1px solid var(--lc-border)",
            background: "var(--lc-surface)", color: "var(--lc-text-muted, #64748b)", cursor: "pointer", fontSize: 10, fontWeight: 700, padding: 0 }}>
          ▾
        </button>
        {menuImpr && (
          <div onMouseLeave={() => setMenuImpr(false)}
            style={{ position: "absolute", top: "100%", insetInlineEnd: 0, zIndex: 20, minWidth: 250,
              background: "var(--lc-surface, #fff)", border: "1px solid #cbd5e1", borderRadius: 10,
              boxShadow: "0 8px 30px rgba(0,0,0,0.18)", padding: 8, textAlign: "start" }}>
            {FORMATS_RECU.map((f) => (
              <button key={f.id} onClick={() => imprimer(f.id)}
                style={{ display: "block", width: "100%", border: "none", cursor: "pointer", padding: "6px 8px",
                  borderRadius: 6, textAlign: "start", color: "#334155",
                  background: f.id === formatRecu ? "#fef3c7" : "none" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{f.icone} {f.label}</span>
                <span style={{ display: "block", fontSize: 10, color: "#64748b" }}>{f.aide}</span>
              </button>
            ))}
          </div>
        )}
      </td>
    </TR>
  );
}
