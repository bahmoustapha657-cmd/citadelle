import { useMemo, useState } from "react";
import { C, anneePrecedente, fmt } from "../../../constants";
import { Badge, Btn, Modale } from "../../ui";
import {
  LIBELLES_POSTES, MOTIFS_EXONERATION, POSTES_EXONERABLES,
  aUneExoneration, getExoneration, libelleMotif, resumeExoneration,
} from "../../../exoneration-utils";
import { getMensualiteOverview } from "../../../mensualite-utils";
import { accorderExoneration, retirerExoneration } from "../exoneration-actions";

const TAUX_PROPOSES = [100, 75, 50, 25];
// `taux` pilote les postes cochés ; il n'est pas enregistré (normaliserExoneration
// ne garde que les trois postes, le motif et la traçabilité).
const BROUILLON_VIDE = { taux: 100, mensualites: 100, inscription: 100, fraisAnnexes: 0, motif: "personnel", precision: "" };

const nomComplet = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim();

// ══════════════════════════════════════════════════════════════
//  Dispenses de paiement — accorder, retirer, reconduire
// ══════════════════════════════════════════════════════════════
// Réservé à la Direction (le contrôle qui fait foi est dans
// exoneration-actions) ; la comptabilité consulte la liste sans la modifier.
export function ExonerationsModale({
  eleves, moisAnnee, tarifsClasses, annee, estDirection, fermer, deps,
}) {
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState(null);
  const [brouillon, setBrouillon] = useState(BROUILLON_VIDE);
  const [enCours, setEnCours] = useState(false);

  const exoneres = useMemo(() => eleves.filter(aUneExoneration), [eleves]);
  const overview = useMemo(
    () => getMensualiteOverview(eleves, moisAnnee, tarifsClasses),
    [eleves, moisAnnee, tarifsClasses],
  );
  // Dispenses de l'an dernier, archivées par la clôture : la rentrée les
  // repropose plutôt que de les reconduire toute seule — une situation change.
  const aReconduire = useMemo(() => {
    const precedente = anneePrecedente(annee);
    if (!precedente) return [];
    return eleves.filter((e) => !aUneExoneration(e) && (e.historique || {})[precedente]?.exoneration);
  }, [eleves, annee]);

  const candidats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return [];
    return eleves
      .filter((e) => nomComplet(e).toLowerCase().includes(q) || (e.matricule || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [eleves, recherche]);

  const executer = async (action) => {
    setEnCours(true);
    try { await action(); } finally { setEnCours(false); }
  };

  const accorder = () => executer(async () => {
    if (await accorderExoneration(choisi, brouillon, { estDirection, annee, ...deps })) {
      setChoisi(null); setRecherche(""); setBrouillon(BROUILLON_VIDE);
    }
  });

  const reconduire = (eleve) => executer(async () => {
    const precedente = (eleve.historique || {})[anneePrecedente(annee)]?.exoneration || {};
    await accorderExoneration(eleve, precedente, { estDirection, annee, ...deps });
  });

  const retirer = (eleve) => executer(() => retirerExoneration(eleve, { estDirection, ...deps }));

  const champ = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 };

  return (
    <Modale large titre="🎓 Dispenses de paiement" fermer={fermer}>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#475569" }}>
        Un élève dispensé n'est plus compté parmi les impayés : ni alertes, ni relances, ni
        bulletins retenus. La dispense vaut pour l'année scolaire <strong>{annee}</strong> ;
        la clôture l'archive et la rentrée propose de la reconduire.
        {!estDirection && <><br/><strong>Consultation seule</strong> — seule la Direction Générale accorde ou retire une dispense.</>}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", background: "#e0ebf8", borderRadius: 8, padding: "9px 14px", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.blueDark }}>🎓 {overview.totalElevesExoneres} élève(s) dispensé(s)</span>
        <Badge color="amber">Manque à gagner : {fmt(overview.totalExonere)}</Badge>
      </div>

      {estDirection && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: ".06em" }}>Accorder une dispense</p>
          {!choisi ? (
            <>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} autoFocus
                placeholder="Rechercher un élève (nom ou matricule)…"
                style={{ ...champ, width: "100%", boxSizing: "border-box" }} />
              {candidats.map((e) => (
                <button key={e._id} onClick={() => setChoisi(e)}
                  style={{ display: "block", width: "100%", textAlign: "start", border: "none", background: "none", cursor: "pointer", padding: "7px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5, color: "#334155" }}>
                  <strong>{nomComplet(e)}</strong> · {e.classe}
                  {aUneExoneration(e) && <span style={{ color: "#b45309" }}> · déjà dispensé ({resumeExoneration(e)})</span>}
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>{nomComplet(choisi)}</strong>
                <Badge color="blue">{choisi.classe}</Badge>
                <Btn sm v="ghost" onClick={() => setChoisi(null)}>Changer d'élève</Btn>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
                {POSTES_EXONERABLES.map((poste) => (
                  <label key={poste} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={brouillon[poste] > 0}
                      onChange={(ev) => setBrouillon((p) => ({ ...p, [poste]: ev.target.checked ? p.taux : 0 }))} />
                    {LIBELLES_POSTES[poste]}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={brouillon.taux}
                  onChange={(ev) => {
                    const taux = Number(ev.target.value);
                    setBrouillon((p) => ({
                      ...p, taux,
                      ...Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, p[poste] > 0 ? taux : 0])),
                    }));
                  }}
                  style={{ ...champ, cursor: "pointer" }}>
                  {TAUX_PROPOSES.map((t) => <option key={t} value={t}>{t === 100 ? "Dispense totale (100 %)" : `Réduction de ${t} %`}</option>)}
                </select>
                <select value={brouillon.motif} onChange={(ev) => setBrouillon((p) => ({ ...p, motif: ev.target.value }))}
                  style={{ ...champ, cursor: "pointer" }}>
                  {MOTIFS_EXONERATION.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <input value={brouillon.precision} onChange={(ev) => setBrouillon((p) => ({ ...p, precision: ev.target.value }))}
                  placeholder={brouillon.motif === "autre" ? "Précisez (obligatoire)" : "Précision (facultative)"}
                  style={{ ...champ, flex: 1, minWidth: 180 }} />
                <Btn sm v="success" disabled={enCours} onClick={accorder}>Accorder</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {aReconduire.length > 0 && estDirection && (
        <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: "#92400e" }}>
            Dispenses de {anneePrecedente(annee)} à reconduire ({aReconduire.length})
          </p>
          {aReconduire.map((e) => (
            <div key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
              <span style={{ flex: 1 }}>{nomComplet(e)} · {e.classe} — {resumeExoneration({ exoneration: (e.historique || {})[anneePrecedente(annee)].exoneration })}</span>
              <Btn sm v="amber" disabled={enCours} onClick={() => reconduire(e)}>Reconduire</Btn>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Dispenses en cours ({exoneres.length})
      </p>
      {exoneres.length === 0
        ? <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucune dispense accordée cette année.</p>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {exoneres.map((e) => {
                  const exo = getExoneration(e);
                  return (
                    <tr key={e._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{nomComplet(e)}</td>
                      <td style={{ padding: "7px 6px" }}><Badge color="blue">{e.classe}</Badge></td>
                      <td style={{ padding: "7px 6px" }}>{resumeExoneration(e)}</td>
                      <td style={{ padding: "7px 6px", color: "#475569" }}>
                        {libelleMotif(exo.motif)}{exo.precision ? ` — ${exo.precision}` : ""}
                      </td>
                      <td style={{ padding: "7px 6px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {exo.accordeePar || "—"}{exo.accordeeLe ? ` · ${exo.accordeeLe}` : ""}
                      </td>
                      <td style={{ padding: "7px 6px", textAlign: "end" }}>
                        {estDirection && <Btn sm v="ghost" disabled={enCours} onClick={() => retirer(e)}>Retirer</Btn>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Modale>
  );
}
