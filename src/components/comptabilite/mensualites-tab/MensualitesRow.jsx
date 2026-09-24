import { useState } from "react";
import { C, fmt, getTarifFraisDivers, initMens } from "../../../constants";
import { Badge, Btn, TR, TD } from "../../ui";
import { imprimerRecu, imprimerRecuTicket } from "../../../reports";
import {
  getEleveMensualiteSnapshot, getFraisAnnexesEleve, getTarifConfigForClasse, montantInscriptionPaye,
} from "../../../mensualite-utils";
import { aUneExoneration, estExonereTotal, resumeExoneration } from "../../../exoneration-utils";
import { FORMATS_RECU, getRecuFormat, labelRecuFormat, setRecuFormat } from "./recu-format";

// Une ligne élève de la grille des mensualités : colonnes figées (matricule,
// nom), bascules mensuelles, frais d'inscription/annexes et impression du reçu.
export function MensualitesRow({
  e, rowIdx, moisAnnee, tarifsClasses, readOnly, canCreate, canEdit, schoolInfo,
  toggleMens, toggleFraisAnnexe, getTarifInscriptionEleve, getTarif,
}) {
  const mens = e.mens || initMens();
  const snapshot = getEleveMensualiteSnapshot(e, moisAnnee, tarifsClasses);
  // Dispense de paiement : un mois non coché n'est plus un impayé, et il n'y a
  // rien à encaisser — la case devient « Exo » et ne se clique plus.
  const exonere = aUneExoneration(e);
  const exonereTotal = estExonereTotal(e, "mensualites");
  const resume = resumeExoneration(e);
  const nomEleve = `${e.nom} ${e.prenom}`;
  // Encaisser demande canCreate (faux en année archivée) ; retirer un
  // encaissement, le verrou admin (canEdit). Même règle que les mois.
  const peutBasculer = (paye) => (paye ? canEdit : canCreate);
  const tarif = getTarifConfigForClasse(tarifsClasses, e.classe);
  const montantInscription = getTarifInscriptionEleve(e);
  const libelleInscription = e.typeInscription === "Réinscription" ? "Réinscription" : "Inscription";
  const montantInscriptionAffiche = e.inscriptionPayee ? montantInscriptionPaye(e, montantInscription) : montantInscription;
  // Frais annexes de l'élève : ceux que la classe facture (autre, révision,
  // catalogue) ET ceux déjà payés que le tarif ne facture plus.
  const lignesFrais = getFraisAnnexesEleve(e, tarif);
  const nbFraisPayes = lignesFrais.filter((l) => l.paye).length;
  const [menuFrais, setMenuFrais] = useState(false);
  // Impression du reçu : le 🖨️ imprime aussitôt dans le format retenu sur ce
  // poste (un clic pour le caissier) ; le ▾ permet d'en changer.
  const [menuImpr, setMenuImpr] = useState(false);
  const [formatRecu, setFormatRecu] = useState(getRecuFormat);
  const imprimer = (format) => {
    setMenuImpr(false);
    setFormatRecu(format);
    setRecuFormat(format);
    const frais = {
      inscription: montantInscription,
      autre: Number(tarif?.autre || 0),
      revision: Number(tarif?.revision || 0),
      divers: getTarifFraisDivers(tarif || {}),
    };
    if (format === "a4") imprimerRecu(e, getTarif(e.classe), schoolInfo, moisAnnee, frais);
    else imprimerRecuTicket(e, getTarif(e.classe), schoolInfo, moisAnnee, frais, Number(format));
  };
  const basculerFrais = (ligne) => toggleFraisAnnexe(e._id, {
    poste: ligne.id,
    eleve: e,
    valeurActuelle: ligne.paye,
    label: ligne.label,
    montant: ligne.montant,
    nomEleve,
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
      <TD bold style={tdSticky(95)}>
        {e.nom} {e.prenom}
        {exonere && <span title={`Dispense de paiement — ${resume}`}
          style={{ marginInlineStart: 6, fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>🎓</span>}
      </TD>
      <TD><Badge color="blue">{e.classe}</Badge></TD>
      <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
      {moisAnnee.map(m => {
        const paye = mens[m] === "Payé";
        const datePaie = (e.mensDates || {})[m] || "";
        // Mois couvert par une dispense totale : rien à encaisser.
        const moisExonere = exonereTotal && !paye;
        const peutCliquer = moisExonere ? false : (paye ? (canCreate && canEdit) : canCreate);
        return <td key={m} style={{ padding: "4px 2px", textAlign: "center" }}>
          <button onClick={() => peutCliquer && toggleMens(e._id, m, mens, e.mensDates || {}, `${e.nom} ${e.prenom}`)}
            title={moisExonere ? `${m} — dispensé (${resume})` : `${m} — ${mens[m] || "Impayé"}${datePaie ? " (" + datePaie + ")" : ""}`}
            style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: peutCliquer ? "pointer" : "default", fontSize: moisExonere ? 9 : 12,
              background: paye ? C.green : moisExonere ? "#fef3c7" : "#e8f0e8",
              color: paye ? "#fff" : moisExonere ? "#92400e" : "#9ca3af",
              fontWeight: 700, opacity: (readOnly || (!peutCliquer && !paye && !moisExonere)) ? 0.6 : 1 }}>
            {paye ? "✓" : moisExonere ? "Exo" : "·"}
          </button>
        </td>;
      })}
      <td style={{ padding: "4px 8px", textAlign: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: snapshot.nbPayes === moisAnnee.length ? C.greenDk : snapshot.nbPayes > 0 ? "#d97706" : "#b91c1c" }}>
          {snapshot.nbPayes}/{moisAnnee.length}
        </span>
      </td>
      <td style={{ padding: "4px 4px", textAlign: "center" }}>
        {(() => {
          const peut = peutBasculer(e.inscriptionPayee);
          return (
            <button onClick={() => peut && toggleFraisAnnexe(e._id, {
              poste: "inscription",
              eleve: e,
              valeurActuelle: !!e.inscriptionPayee,
              label: libelleInscription,
              montant: montantInscriptionAffiche,
              nomEleve,
            })} title={`${libelleInscription} — ${fmt(montantInscriptionAffiche)}${e.inscriptionDate ? ` (${e.inscriptionDate})` : ""}`}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: peut ? "pointer" : "default", fontSize: 11,
                background: e.inscriptionPayee ? C.blue : "#f1f3f4", color: e.inscriptionPayee ? "#fff" : "#9ca3af", fontWeight: 700,
                opacity: !peut && !e.inscriptionPayee ? 0.6 : 1 }}>
              {e.inscriptionPayee ? "✓" : "I"}
            </button>
          );
        })()}
      </td>
      <td style={{ padding: "4px 4px", textAlign: "center", position: "relative" }}>
        {lignesFrais.length === 0 ? (
          <span title="Aucun frais annexe configuré pour cette classe (Tarifs par classe)"
            style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>
        ) : (
          <>
            <button onClick={() => setMenuFrais((v) => !v)}
              title={`Frais annexes : ${nbFraisPayes}/${lignesFrais.length} payé(s)`}
              style={{ minWidth: 34, height: 26, borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10,
                background: nbFraisPayes === lignesFrais.length ? "#475569" : nbFraisPayes > 0 ? "#f59e0b" : "#f1f3f4",
                color: nbFraisPayes > 0 ? "#fff" : "#9ca3af", fontWeight: 700, padding: "0 6px" }}>
              {nbFraisPayes}/{lignesFrais.length}
            </button>
            {menuFrais && (
              <div onMouseLeave={() => setMenuFrais(false)}
                style={{ position: "absolute", top: "100%", insetInlineEnd: 0, zIndex: 20, minWidth: 230,
                  background: "var(--lc-surface, #fff)", border: "1px solid #cbd5e1", borderRadius: 10,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.18)", padding: 8, textAlign: "start" }}>
                {lignesFrais.map((ligne) => {
                  const peut = peutBasculer(ligne.paye);
                  return (
                    <button key={ligne.id} onClick={() => { if (!peut) return; setMenuFrais(false); basculerFrais(ligne); }}
                      title={ligne.paye
                        ? `Payé le ${ligne.date || "—"}${ligne.du === 0 ? " — n'est plus facturé à cette classe" : ""}`
                        : `À payer : ${fmt(ligne.du)}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
                        border: "none", background: "none", cursor: peut ? "pointer" : "default", opacity: peut || ligne.paye ? 1 : 0.6,
                        padding: "6px 8px", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                      <span style={{ fontWeight: 600 }}>{ligne.label}</span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: ligne.paye ? "#059669" : "#94a3b8" }}>
                        {Number(ligne.montant).toLocaleString("fr-FR")} {ligne.paye ? "✓" : "·"}
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
