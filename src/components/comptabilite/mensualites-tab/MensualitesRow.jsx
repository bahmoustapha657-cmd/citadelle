import { useState } from "react";
import { C, estSorti, fmt, initMens } from "../../../constants";
import { Badge, Btn, TR, TD } from "../../ui";
import {
  acompteInscription, acompteMois, getEleveMensualiteSnapshot, getFraisAnnexesEleve, getTarifConfigForClasse,
  getTarifMensuelForClasse, montantDuInscription, montantDuMois, montantInscriptionPaye, montantMoisPaye,
} from "../../../mensualite-utils";
import { lireDate, moisExigibles } from "../../../depart-utils";
import { aUneExoneration, estExonereTotal, resumeExoneration } from "../../../exoneration-utils";
import { FORMATS_RECU, getRecuFormat, labelRecuFormat, setRecuFormat } from "./recu-format";
import { imprimerRecuEleve } from "./recu-eleve";

// Couleurs d'une case « entamée » : un acompte versé, pas encore soldé.
const PARTIEL = { background: "#fde68a", color: "#92400e" };

// Une ligne élève de la grille des mensualités : colonnes figées (matricule,
// nom), bascules mensuelles, frais d'inscription/annexes, encaissement d'un
// montant libre et impression du reçu.
export function MensualitesRow({
  e, rowIdx, moisAnnee, annee, tarifsClasses, readOnly, canCreate, canEdit, schoolInfo,
  toggleMens, toggleFraisAnnexe, getTarifInscriptionEleve, ouvrirEncaissement,
}) {
  const mens = e.mens || initMens();
  const snapshot = getEleveMensualiteSnapshot(e, moisAnnee, tarifsClasses, annee);
  // Élève parti : les mois qui suivent son départ ne sont pas des impayés —
  // la case devient « — » et ne se clique plus (un mois déjà réglé reste
  // affiché, donc annulable).
  const sorti = estSorti(e);
  const depart = lireDate(e.dateDepart)?.toLocaleDateString("fr-FR") || "";
  const dus = new Set(moisExigibles(e, moisAnnee, annee));
  const nbAttendus = moisAnnee.filter((m) => dus.has(m) || mens[m] === "Payé").length;
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
  const mensualite = getTarifMensuelForClasse(tarifsClasses, e.classe);
  const duMois = montantDuMois(e, mensualite);
  const montantInscription = getTarifInscriptionEleve(e);
  const libelleInscription = e.typeInscription === "Réinscription" ? "Réinscription" : "Inscription";
  const duInscription = montantDuInscription(e, montantInscription);
  const acompteIns = e.inscriptionPayee ? 0 : acompteInscription(e);
  // Frais annexes de l'élève : ceux que la classe facture (autre, révision,
  // catalogue) ET ceux déjà payés que le tarif ne facture plus.
  const lignesFrais = getFraisAnnexesEleve(e, tarif);
  const nbFraisPayes = lignesFrais.filter((l) => l.paye).length;
  const nbFraisEntames = lignesFrais.filter((l) => !l.paye && l.verse > 0).length;
  const [menuFrais, setMenuFrais] = useState(false);
  // Impression du reçu : le 🖨️ imprime aussitôt dans le format retenu sur ce
  // poste (un clic pour le caissier) ; le ▾ permet d'en changer.
  const [menuImpr, setMenuImpr] = useState(false);
  const [formatRecu, setFormatRecu] = useState(getRecuFormat);
  const imprimer = (format) => {
    setMenuImpr(false);
    setFormatRecu(format);
    setRecuFormat(format);
    imprimerRecuEleve({ eleve: e, tarifsClasses, moisAnnee, annee, schoolInfo, format });
  };
  // Un clic solde le frais : son dû net (l'acompte éventuel est déduit par
  // l'action) ; sur un frais payé, il le retire au montant encaissé.
  const basculerFrais = (ligne) => toggleFraisAnnexe(e._id, {
    poste: ligne.id,
    eleve: e,
    valeurActuelle: ligne.paye,
    label: ligne.label,
    montant: ligne.paye ? ligne.montant : ligne.duNet,
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
        {sorti && <span title={`${e.statut}${depart ? ` le ${depart}` : " (date de départ inconnue)"} — seuls les mois entamés avant le départ sont dus`}
          style={{ marginInlineStart: 6, fontSize: 10, background: "#f1f5f9", color: "#475569", borderRadius: 4, padding: "1px 5px", fontWeight: 700, whiteSpace: "nowrap" }}>
          📤 {e.statut}{depart ? ` le ${depart}` : ""}
        </span>}
      </TD>
      <TD><Badge color="blue">{e.classe}</Badge></TD>
      <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
      {moisAnnee.map(m => {
        const paye = mens[m] === "Payé";
        const datePaie = (e.mensDates || {})[m] || "";
        const acompte = paye ? 0 : acompteMois(e, m);
        // Mois postérieur au départ : rien à encaisser. Un acompte déjà versé
        // reste affiché (◐), annulable depuis la fenêtre 💰.
        const horsDu = !paye && !dus.has(m);
        const apresDepart = horsDu && acompte === 0;
        // Mois couvert par une dispense totale : rien à encaisser.
        const moisExonere = !horsDu && exonereTotal && !paye && acompte === 0;
        const peutCliquer = horsDu || moisExonere ? false : (paye ? (canCreate && canEdit) : canCreate);
        const titre = apresDepart ? `${m} — après le départ${depart ? ` (${depart})` : ""} : non dû`
          : horsDu ? `${m} — après le départ : acompte ${fmt(acompte)} versé, à annuler depuis 💰`
          : moisExonere ? `${m} — dispensé (${resume})`
            : paye ? `${m} — payé ${fmt(montantMoisPaye(e, m, mensualite))}${datePaie ? ` (${datePaie})` : ""}`
              : acompte > 0 ? `${m} — acompte ${fmt(acompte)}, reste ${fmt(Math.max(0, duMois - acompte))}`
                : `${m} — impayé (${fmt(duMois)})`;
        return <td key={m} style={{ padding: "4px 2px", textAlign: "center" }}>
          <button onClick={() => peutCliquer && toggleMens(e._id, m, mens, e.mensDates || {}, nomEleve)}
            title={titre}
            style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: peutCliquer ? "pointer" : "default", fontSize: moisExonere ? 9 : 12,
              background: paye ? C.green : acompte > 0 ? PARTIEL.background : apresDepart ? "#f1f5f9" : moisExonere ? "#fef3c7" : "#e8f0e8",
              color: paye ? "#fff" : acompte > 0 ? PARTIEL.color : apresDepart ? "#cbd5e1" : moisExonere ? "#92400e" : "#9ca3af",
              fontWeight: 700, opacity: (readOnly || (!peutCliquer && !paye && !moisExonere && !apresDepart && acompte === 0)) ? 0.6 : 1 }}>
            {paye ? "✓" : acompte > 0 ? "◐" : apresDepart ? "—" : moisExonere ? "Exo" : "·"}
          </button>
        </td>;
      })}
      <td style={{ padding: "4px 8px", textAlign: "center" }}>
        <span title={[
          sorti ? "Mois payés / mois dus jusqu'au départ" : "",
          snapshot.nbPartiels > 0 ? `${snapshot.nbPartiels} mois entamé(s) par un acompte` : "",
        ].filter(Boolean).join(" — ") || undefined}
          style={{ fontWeight: 800, fontSize: 13, color: snapshot.nbPayes === nbAttendus ? C.greenDk : snapshot.nbPayes > 0 ? "#d97706" : "#b91c1c" }}>
          {snapshot.nbPayes}/{nbAttendus}{snapshot.nbPartiels > 0 ? " ◐" : ""}
        </span>
      </td>
      <td style={{ padding: "4px 4px", textAlign: "center" }}>
        {(() => {
          const paye = !!e.inscriptionPayee;
          const peut = peutBasculer(paye);
          const montantAffiche = paye ? montantInscriptionPaye(e, montantInscription) : duInscription;
          const titre = paye ? `${libelleInscription} — ${fmt(montantAffiche)}${e.inscriptionDate ? ` (${e.inscriptionDate})` : ""}`
            : acompteIns > 0 ? `${libelleInscription} — acompte ${fmt(acompteIns)}, reste ${fmt(Math.max(0, duInscription - acompteIns))}`
              : `${libelleInscription} — ${duInscription > 0 ? fmt(duInscription) : "dispensée"}`;
          return (
            <button onClick={() => peut && toggleFraisAnnexe(e._id, {
              poste: "inscription",
              eleve: e,
              valeurActuelle: paye,
              label: libelleInscription,
              montant: montantAffiche,
              nomEleve,
            })} title={titre}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", cursor: peut ? "pointer" : "default", fontSize: 11,
                background: paye ? C.blue : acompteIns > 0 ? PARTIEL.background : "#f1f3f4",
                color: paye ? "#fff" : acompteIns > 0 ? PARTIEL.color : "#9ca3af", fontWeight: 700,
                opacity: !peut && !paye ? 0.6 : 1 }}>
              {paye ? "✓" : acompteIns > 0 ? "◐" : "I"}
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
              title={`Frais annexes : ${nbFraisPayes}/${lignesFrais.length} payé(s)${nbFraisEntames ? `, ${nbFraisEntames} entamé(s)` : ""}`}
              style={{ minWidth: 34, height: 26, borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10,
                background: nbFraisPayes === lignesFrais.length ? "#475569" : nbFraisPayes + nbFraisEntames > 0 ? "#f59e0b" : "#f1f3f4",
                color: nbFraisPayes + nbFraisEntames > 0 ? "#fff" : "#9ca3af", fontWeight: 700, padding: "0 6px" }}>
              {nbFraisPayes}/{lignesFrais.length}{nbFraisEntames ? " ◐" : ""}
            </button>
            {menuFrais && (
              <div onMouseLeave={() => setMenuFrais(false)}
                style={{ position: "absolute", top: "100%", insetInlineEnd: 0, zIndex: 20, minWidth: 250,
                  background: "var(--lc-surface, #fff)", border: "1px solid #cbd5e1", borderRadius: 10,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.18)", padding: 8, textAlign: "start" }}>
                {lignesFrais.map((ligne) => {
                  const entame = !ligne.paye && ligne.verse > 0;
                  const dispense = !ligne.paye && ligne.duNet === 0;
                  const peut = !dispense && peutBasculer(ligne.paye);
                  return (
                    <button key={ligne.id} onClick={() => { if (!peut) return; setMenuFrais(false); basculerFrais(ligne); }}
                      title={ligne.paye
                        ? `Payé le ${ligne.date || "—"}${ligne.du === 0 ? " — n'est plus facturé à cette classe" : ""}`
                        : dispense ? "Dispensé (cf. 🎓 Dispenses)"
                          : entame ? `Acompte ${fmt(ligne.verse)} — cliquer pour solder le reste (${fmt(ligne.reste)})`
                            : `À payer : ${fmt(ligne.duNet)}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
                        border: "none", background: "none", cursor: peut ? "pointer" : "default", opacity: peut || ligne.paye ? 1 : 0.6,
                        padding: "6px 8px", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                      <span style={{ fontWeight: 600 }}>{ligne.label}</span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 700,
                        color: ligne.paye ? "#059669" : entame ? PARTIEL.color : "#94a3b8" }}>
                        {ligne.paye ? `${fmt(ligne.montant)} ✓`
                          : dispense ? "Exo"
                            : entame ? `◐ ${fmt(ligne.verse)} / ${fmt(ligne.duNet)}`
                              : `${fmt(ligne.duNet)} ·`}
                      </span>
                    </button>
                  );
                })}
                {canCreate && ouvrirEncaissement && (
                  <button onClick={() => { setMenuFrais(false); ouvrirEncaissement(e); }}
                    style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                      border: "1px dashed #cbd5e1", background: "none", fontSize: 11, fontWeight: 700, color: C.blue, textAlign: "start" }}>
                    💰 Payer un montant (acompte)…
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </td>
      <td style={{ padding: "4px 6px", textAlign: "center", position: "relative", whiteSpace: "nowrap" }}>
        {canCreate && ouvrirEncaissement && (
          <span style={{ marginInlineEnd: 3 }}>
            <Btn sm v="success" title="Encaisser un montant : réparti sur les mois, une tranche, ou un acompte sur un frais"
              onClick={() => ouvrirEncaissement(e)}>💰</Btn>
          </span>
        )}
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
