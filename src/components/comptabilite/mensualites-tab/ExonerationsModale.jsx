import { useMemo, useRef, useState } from "react";
import { C, anneePrecedente, fmt } from "../../../constants";
import { Badge, Btn, Modale } from "../../ui";
import {
  LIBELLES_POSTES, MOTIFS_EXONERATION, POSTES_EXONERABLES,
  aUneExoneration, clampPourcentage, getExoneration, libelleMotif, resumeExoneration,
} from "../../../exoneration-utils";
import { getMensualiteOverview } from "../../../mensualite-utils";
import { accorderExoneration, retirerExoneration } from "../exoneration-actions";
import { brouillonDepuis, versExoneration } from "./exoneration-brouillon";

const nomComplet = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim();

// Taux d'un poste, de 1 à 100 %. Le TEXTE vit ici le temps de la frappe :
// vider le champ pour retaper un taux ne touche ni à la case cochée ni au
// taux retenu, et quitter un champ vide ou illisible rend le taux d'avant.
function ChampTaux({ taux, actif, onTaux, label, style }) {
  const [texte, setTexte] = useState(null); // null : aucune frappe en cours
  const avant = useRef(taux);
  return (
    <input type="number" min={1} max={100} step={1} disabled={!actif} aria-label={label}
      value={actif ? (texte ?? String(taux)) : ""}
      onFocus={() => { avant.current = taux; setTexte(String(taux)); }}
      onChange={(ev) => {
        const brut = ev.target.value;
        // Borné à la frappe : « 250 » s'affiche aussitôt 100.
        setTexte(Number(brut) > 100 ? "100" : brut);
        const n = clampPourcentage(brut);
        if (n > 0) onTaux(n);
      }}
      onBlur={() => {
        if (clampPourcentage(texte) === 0) onTaux(avant.current);
        setTexte(null);
      }}
      style={{ ...style, opacity: actif ? 1 : 0.4 }} />
  );
}

// Identité de l'élève : matricule, IEN et filiation. Les homonymes sont
// courants ; dispenser le mauvais « DIALLO Mamadou » se verrait tard, et
// l'IEN comme les parents sont ce qui les départage.
function Identite({ eleve, bloc = false }) {
  const reperes = [eleve.matricule, eleve.ien && `IEN ${eleve.ien}`].filter(Boolean).join(" · ");
  return (
    <span style={{ display: bloc ? "block" : "inline", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
      {reperes}
      {eleve.filiation && <span style={{ display: bloc ? "block" : "inline" }}>{bloc ? "" : " · "}{eleve.filiation}</span>}
    </span>
  );
}

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
  const [brouillon, setBrouillon] = useState(() => brouillonDepuis());
  const [enCours, setEnCours] = useState(false);

  const exoneres = useMemo(() => eleves.filter(aUneExoneration), [eleves]);
  const overview = useMemo(
    () => getMensualiteOverview(eleves, moisAnnee, tarifsClasses, annee),
    [eleves, moisAnnee, tarifsClasses, annee],
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
      .filter((e) => nomComplet(e).toLowerCase().includes(q)
        || (e.matricule || "").toLowerCase().includes(q)
        || (e.ien || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [eleves, recherche]);

  const executer = async (action) => {
    setEnCours(true);
    try { await action(); } finally { setEnCours(false); }
  };

  // Choisir un élève déjà dispensé reprend sa dispense : la modifier ne
  // doit pas obliger à ressaisir tous les taux.
  const choisir = (eleve) => { setChoisi(eleve); setBrouillon(brouillonDepuis(getExoneration(eleve))); };

  const accorder = () => executer(async () => {
    if (await accorderExoneration(choisi, versExoneration(brouillon), { estDirection, annee, ...deps })) {
      setChoisi(null); setRecherche(""); setBrouillon(brouillonDepuis());
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
                placeholder="Rechercher un élève (nom, matricule ou IEN)…"
                style={{ ...champ, width: "100%", boxSizing: "border-box" }} />
              {candidats.map((e) => (
                <button key={e._id} onClick={() => choisir(e)}
                  style={{ display: "block", width: "100%", textAlign: "start", border: "none", background: "none", cursor: "pointer", padding: "7px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5, color: "#334155" }}>
                  <strong>{nomComplet(e)}</strong> · {e.classe}
                  {aUneExoneration(e) && <span style={{ color: "#b45309" }}> · déjà dispensé ({resumeExoneration(e)})</span>}
                  <Identite eleve={e} bloc />
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{nomComplet(choisi)}</strong>
                <Badge color="blue">{choisi.classe}</Badge>
                <Btn sm v="ghost" onClick={() => setChoisi(null)}>Changer d'élève</Btn>
              </div>
              {/* Relire l'identité AVANT de dispenser : c'est le dernier moment
                  où l'on peut s'apercevoir qu'on tient un homonyme. */}
              <div style={{ marginBottom: 10 }}><Identite eleve={choisi} bloc /></div>
              {aUneExoneration(choisi) && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#b45309" }}>
                  Dispense en cours : {resumeExoneration(choisi)}. Les taux ci-dessous la remplaceront.
                </p>
              )}
              {/* Un taux LIBRE par poste : une école dispense rarement au même
                  niveau partout (mensualités à 100 %, inscription à 30 %…), et
                  les paliers ronds ne couvrent pas les arrangements réels. */}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
                {POSTES_EXONERABLES.map((poste) => (
                  <div key={poste} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={brouillon.actifs[poste]}
                        onChange={(ev) => setBrouillon((p) => ({ ...p, actifs: { ...p.actifs, [poste]: ev.target.checked } }))} />
                      {LIBELLES_POSTES[poste]}
                    </label>
                    <ChampTaux taux={brouillon.taux[poste]} actif={brouillon.actifs[poste]}
                      label={`Taux — ${LIBELLES_POSTES[poste]}`}
                      onTaux={(taux) => setBrouillon((p) => ({ ...p, taux: { ...p.taux, [poste]: taux } }))}
                      style={{ ...champ, width: 66, padding: "6px 8px" }} />
                    <span style={{ color: "#64748b" }}>%</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
              <span style={{ flex: 1 }}>
                {nomComplet(e)} · {e.classe} — {resumeExoneration({ exoneration: (e.historique || {})[anneePrecedente(annee)].exoneration })}
                <Identite eleve={e} bloc />
              </span>
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
                      <td style={{ padding: "7px 6px" }}>
                        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{nomComplet(e)}</span>
                        <Identite eleve={e} bloc />
                      </td>
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
