import { useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { C, anneePrecedente, fmt } from "../../../constants";
import { Badge, Btn, Modale } from "../../ui";
import {
  MOTIFS_EXONERATION, POSTES_EXONERABLES,
  aUneExoneration, clampPourcentage, getExoneration,
} from "../../../exoneration-utils";
import {
  STATUT_REFUSEE, attentesParSection, demandeEnAttente, elevesDemandeEnAttente, elevesDemandeRefusee,
  exonerationDepuisDemande, getDemande,
} from "../../../demande-dispense";
import { libelleSection } from "../../../i18n/libelles";
import { libelleMotifAffiche, libellePoste, resumeExonerationAffiche } from "../exoneration-affichage";
import { getMensualiteOverview } from "../../../mensualite-utils";
import {
  accorderExoneration, demanderDispense, refuserDemandeDispense,
  retirerDemandeDispense, retirerExoneration,
} from "../exoneration-actions";
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
  const reperes = [eleve.matricule, eleve.ien && `Matricule ${eleve.ien}`].filter(Boolean).join(" · ");
  return (
    <span style={{ display: bloc ? "block" : "inline", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
      {reperes}
      {eleve.filiation && <span style={{ display: bloc ? "block" : "inline" }}>{bloc ? "" : " · "}{eleve.filiation}</span>}
    </span>
  );
}

const titreBloc = { margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: ".06em" };

// ══════════════════════════════════════════════════════════════
//  Dispenses de paiement — accorder, retirer, reconduire, demander
// ══════════════════════════════════════════════════════════════
// Accorder et retirer sont réservés à la Direction (le contrôle qui fait foi
// est dans exoneration-actions). La comptabilité (`peutDemander`) remplit le
// même formulaire et l'ENVOIE à la Direction, qui l'accorde telle quelle, la
// corrige ou la refuse en disant pourquoi (cf. demande-dispense).
//
// La fenêtre choisit sa SECTION (boutons en tête, avec ce qui y attend :
// demandes pour la Direction, refus à lire pour la comptabilité). Elle reçoit
// donc les élèves et l'écriture de chaque section (`elevesParSection`,
// `modParSection`, cf. use-comptabilite) : ouverte depuis Mensualités comme
// depuis l'Enrôlement, elle ne dépend plus de la section de l'onglet.
// `eleveInitialId` : élève à préparer d'emblée (bouton 🎓 d'une ligne de
// l'Enrôlement), cherché dans `sectionInitiale`.
export function ExonerationsModale({
  elevesParSection = {}, modParSection = {}, sections = [], sectionInitiale = "", eleveInitialId = null,
  moisAnnee, tarifsClasses, annee, estDirection, peutDemander = false, fermer, deps,
}) {
  const { t } = useTranslation();
  const [section, setSection] = useState(() => (sections.includes(sectionInitiale) ? sectionInitiale : sections[0] || "college"));
  const eleves = useMemo(() => elevesParSection[section] || [], [elevesParSection, section]);
  // Écriture de la section affichée : une fiche s'enregistre dans SA table.
  const depsSection = { ...deps, modEleves: modParSection[section] };
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState(() => (eleveInitialId && eleves.find((e) => e._id === eleveInitialId)) || null);
  const [brouillon, setBrouillon] = useState(() => brouillonDepuis(choisi ? (getDemande(choisi, annee) || getExoneration(choisi)) : null));
  const [enCours, setEnCours] = useState(false);
  // Refus en cours de rédaction : { id, raison }.
  const [refus, setRefus] = useState(null);
  const formulaire = useRef(null);
  const attentes = useMemo(
    () => attentesParSection(elevesParSection, sections, annee, { direction: estDirection }),
    [elevesParSection, sections, annee, estDirection],
  );

  const exoneres = useMemo(() => eleves.filter(aUneExoneration), [eleves]);
  const enAttente = useMemo(() => elevesDemandeEnAttente(eleves, annee), [eleves, annee]);
  const refusees = useMemo(() => elevesDemandeRefusee(eleves, annee), [eleves, annee]);
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

  const peutSaisir = estDirection || peutDemander;

  const executer = async (action) => {
    setEnCours(true);
    try { await action(); } finally { setEnCours(false); }
  };

  const reinitialiser = () => { setChoisi(null); setRecherche(""); setBrouillon(brouillonDepuis()); };

  const changerSection = (s) => { if (s === section) return; setRefus(null); reinitialiser(); setSection(s); };

  // Choisir un élève reprend ce qui le concerne déjà — la demande en cours,
  // sinon sa dispense : la modifier ne doit pas obliger à ressaisir les taux.
  const choisir = (eleve) => {
    setChoisi(eleve);
    setBrouillon(brouillonDepuis(getDemande(eleve, annee) || getExoneration(eleve)));
  };

  const accorder = () => executer(async () => {
    if (await accorderExoneration(choisi, versExoneration(brouillon), { estDirection, annee, ...depsSection })) reinitialiser();
  });

  const envoyer = () => executer(async () => {
    if (await demanderDispense(choisi, versExoneration(brouillon), { estDirection, annee, ...depsSection })) reinitialiser();
  });

  const reconduire = (eleve) => executer(async () => {
    const precedente = (eleve.historique || {})[anneePrecedente(annee)]?.exoneration || {};
    await accorderExoneration(eleve, precedente, { estDirection, annee, ...depsSection });
  });

  const retirer = (eleve) => executer(() => retirerExoneration(eleve, { estDirection, ...depsSection }));

  // Demande acceptée telle quelle : les taux et le motif de la comptabilité.
  const accorderDemande = (eleve) => executer(() =>
    accorderExoneration(eleve, exonerationDepuisDemande(getDemande(eleve, annee)), { estDirection, annee, ...depsSection }));

  // Demande à corriger : elle remplit le formulaire, la Direction ajuste puis
  // accorde (la demande quitte alors la fiche).
  const modifierDemande = (eleve) => {
    choisir(eleve);
    formulaire.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };

  const refuser = (eleve) => executer(async () => {
    if (await refuserDemandeDispense(eleve, refus?.raison, { estDirection, annee, ...depsSection })) setRefus(null);
  });

  const retirerDemande = (eleve) => executer(() => retirerDemandeDispense(eleve, depsSection));

  const champ = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 };

  const resumeDemande = (demande) => (
    <>
      {resumeExonerationAffiche({ exoneration: demande })} — {libelleMotifAffiche(demande.motif)}
      {demande.precision ? ` — ${demande.precision}` : ""}
    </>
  );

  return (
    <Modale large titre={`🎓 ${t("accounting.exempt.title")}`} fermer={fermer}>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#475569" }}>
        <Trans i18nKey="accounting.exempt.intro" values={{ year: annee }} components={{ b: <strong /> }} />
        {!estDirection && <><br/><Trans i18nKey={peutDemander ? "accounting.exempt.request.introCanAsk" : "accounting.exempt.readOnly"} components={{ b: <strong /> }} /></>}
      </p>

      {/* Section : la fenêtre ne montre qu'une section à la fois (ses élèves,
          ses dispenses, ses demandes). Le chiffre rouge signale ce qui attend
          dans chacune. */}
      {sections.length > 1 && (
        <div role="tablist" aria-label={t("accounting.exempt.sectionLabel")}
          style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{t("accounting.exempt.sectionLabel")}</span>
          {sections.map((s) => {
            const actif = s === section;
            return (
              <button key={s} type="button" role="tab" aria-selected={actif} onClick={() => changerSection(s)}
                style={{
                  border: `1.5px solid ${actif ? C.blueDark : "#cbd5e1"}`, background: actif ? C.blueDark : "#fff",
                  color: actif ? "#fff" : C.blueDark, borderRadius: 999, padding: "4px 12px", fontSize: 12,
                  fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                {libelleSection(s)}
                {attentes[s] > 0 && (
                  <span style={{ background: "#dc2626", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10.5, fontWeight: 800, lineHeight: "16px", minWidth: 16, textAlign: "center" }}>
                    {attentes[s]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", background: "#e0ebf8", borderRadius: 8, padding: "9px 14px", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.blueDark }}>🎓 {t("accounting.exempt.count", { count: overview.totalElevesExoneres })}</span>
        <Badge color="amber">{t("accounting.exempt.shortfall", { amount: fmt(overview.totalExonere) })}</Badge>
      </div>

      {/* Direction : les demandes de la comptabilité, en tête — c'est ce
          qu'elle vient chercher quand la pastille ou le tableau de bord l'a
          prévenue. */}
      {estDirection && enAttente.length > 0 && (
        <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ ...titreBloc, color: "#92400e" }}>{t("accounting.exempt.request.inbox", { count: enAttente.length })}</p>
          {enAttente.map((e, i) => {
            const demande = getDemande(e, annee);
            return (
              <div key={e._id} style={{ padding: "8px 0", borderTop: i ? "1px solid #fde68a" : "none" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <span style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: "#334155" }}>
                    <strong>{nomComplet(e)}</strong> · {e.classe}
                    <Identite eleve={e} bloc />
                    <span style={{ display: "block", marginTop: 2 }}>{resumeDemande(demande)}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                      {t("accounting.exempt.request.askedBy", { author: demande.demandeePar || "—", date: demande.demandeeLe || "—" })}
                    </span>
                    {aUneExoneration(e) && (
                      <span style={{ display: "block", fontSize: 11, color: "#b45309" }}>
                        {t("accounting.exempt.request.replaces", { summary: resumeExonerationAffiche(e) })}
                      </span>
                    )}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn sm v="success" disabled={enCours} onClick={() => accorderDemande(e)}>{t("accounting.exempt.request.accept")}</Btn>
                    <Btn sm v="ghost" disabled={enCours} onClick={() => modifierDemande(e)}>{t("accounting.exempt.request.edit")}</Btn>
                    <Btn sm v="ghost" disabled={enCours} onClick={() => setRefus({ id: e._id, raison: "" })}>{t("accounting.exempt.request.refuse")}</Btn>
                  </div>
                </div>
                {refus?.id === e._id && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                    <input autoFocus value={refus.raison} onChange={(ev) => setRefus({ id: e._id, raison: ev.target.value })}
                      placeholder={t("accounting.exempt.request.refuseReason")}
                      style={{ ...champ, flex: 1, minWidth: 200 }} />
                    <Btn sm v="danger" disabled={enCours} onClick={() => refuser(e)}>{t("accounting.exempt.request.refuseConfirm")}</Btn>
                    <Btn sm v="ghost" disabled={enCours} onClick={() => setRefus(null)}>{t("accounting.exempt.request.cancel")}</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comptabilité : ses demandes, et la réponse de la Direction quand
          elle a refusé. Une demande accordée quitte cette liste et rejoint
          les dispenses en cours. */}
      {!estDirection && enAttente.length + refusees.length > 0 && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={titreBloc}>{t("accounting.exempt.request.mine", { count: enAttente.length + refusees.length })}</p>
          {[...refusees, ...enAttente].map((e, i) => {
            const demande = getDemande(e, annee);
            const refusee = demande.statut === STATUT_REFUSEE;
            return (
              <div key={e._id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "7px 0", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                <span style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: "#334155" }}>
                  <strong>{nomComplet(e)}</strong> · {e.classe} — {resumeDemande(demande)}
                  <span style={{ display: "block", fontSize: 11.5, marginTop: 2, color: refusee ? "#b91c1c" : "#92400e", fontWeight: refusee ? 700 : 400 }}>
                    {refusee
                      ? `✖ ${t("accounting.exempt.request.refusedBy", { author: demande.refuseePar || "—", date: demande.refuseeLe || "—", reason: demande.motifRefus })}`
                      : `⏳ ${t("accounting.exempt.request.pending")} · ${t("accounting.exempt.request.askedBy", { author: demande.demandeePar || "—", date: demande.demandeeLe || "—" })}`}
                  </span>
                </span>
                {peutDemander && (
                  <Btn sm v="ghost" disabled={enCours} onClick={() => retirerDemande(e)}>
                    {refusee ? t("accounting.exempt.request.seen") : t("accounting.exempt.request.withdraw")}
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}

      {peutSaisir && (
        <div ref={formulaire} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <p style={titreBloc}>{estDirection ? t("accounting.exempt.grant") : t("accounting.exempt.request.formTitle")}</p>
          {!choisi ? (
            <>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} autoFocus
                placeholder={t("accounting.exempt.searchPlaceholder")}
                style={{ ...champ, width: "100%", boxSizing: "border-box" }} />
              {candidats.map((e) => (
                <button key={e._id} onClick={() => choisir(e)}
                  style={{ display: "block", width: "100%", textAlign: "start", border: "none", background: "none", cursor: "pointer", padding: "7px 6px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5, color: "#334155" }}>
                  <strong>{nomComplet(e)}</strong> · {e.classe}
                  {aUneExoneration(e) && <span style={{ color: "#b45309" }}>{t("accounting.exempt.alreadyExempt", { summary: resumeExonerationAffiche(e) })}</span>}
                  {demandeEnAttente(e, annee) && <span style={{ color: "#92400e" }}>{t("accounting.exempt.request.pendingTag")}</span>}
                  <Identite eleve={e} bloc />
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{nomComplet(choisi)}</strong>
                <Badge color="blue">{choisi.classe}</Badge>
                <Btn sm v="ghost" onClick={() => setChoisi(null)}>{t("accounting.exempt.changeStudent")}</Btn>
              </div>
              {/* Relire l'identité AVANT de dispenser : c'est le dernier moment
                  où l'on peut s'apercevoir qu'on tient un homonyme. */}
              <div style={{ marginBottom: 10 }}><Identite eleve={choisi} bloc /></div>
              {aUneExoneration(choisi) && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#b45309" }}>
                  {t("accounting.exempt.current", { summary: resumeExonerationAffiche(choisi) })}
                </p>
              )}
              {demandeEnAttente(choisi, annee) && (() => {
                const demande = getDemande(choisi, annee);
                return (
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "#92400e" }}>
                    {estDirection
                      ? t("accounting.exempt.request.askedBy", { author: demande.demandeePar || "—", date: demande.demandeeLe || "—" })
                      : t("accounting.exempt.request.alreadyPending", { date: demande.demandeeLe || "—" })}
                  </p>
                );
              })()}
              {/* Un taux LIBRE par poste : une école dispense rarement au même
                  niveau partout (mensualités à 100 %, inscription à 30 %…), et
                  les paliers ronds ne couvrent pas les arrangements réels. */}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
                {POSTES_EXONERABLES.map((poste) => (
                  <div key={poste} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={brouillon.actifs[poste]}
                        onChange={(ev) => setBrouillon((p) => ({ ...p, actifs: { ...p.actifs, [poste]: ev.target.checked } }))} />
                      {libellePoste(poste)}
                    </label>
                    <ChampTaux taux={brouillon.taux[poste]} actif={brouillon.actifs[poste]}
                      label={t("accounting.exempt.rateFor", { label: libellePoste(poste) })}
                      onTaux={(taux) => setBrouillon((p) => ({ ...p, taux: { ...p.taux, [poste]: taux } }))}
                      style={{ ...champ, width: 66, padding: "6px 8px" }} />
                    <span style={{ color: "#64748b" }}>%</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={brouillon.motif} onChange={(ev) => setBrouillon((p) => ({ ...p, motif: ev.target.value }))}
                  style={{ ...champ, cursor: "pointer" }}>
                  {MOTIFS_EXONERATION.map((m) => <option key={m.id} value={m.id}>{libelleMotifAffiche(m.id)}</option>)}
                </select>
                <input value={brouillon.precision} onChange={(ev) => setBrouillon((p) => ({ ...p, precision: ev.target.value }))}
                  placeholder={brouillon.motif === "autre" ? t("accounting.exempt.specifyRequired") : t("accounting.exempt.specifyOptional")}
                  style={{ ...champ, flex: 1, minWidth: 180 }} />
                {estDirection
                  ? <Btn sm v="success" disabled={enCours} onClick={accorder}>{t("accounting.exempt.grantBtn")}</Btn>
                  : <Btn sm v="amber" disabled={enCours} onClick={envoyer}>{t("accounting.exempt.request.sendBtn")}</Btn>}
              </div>
            </>
          )}
        </div>
      )}

      {aReconduire.length > 0 && estDirection && (
        <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: "#92400e" }}>
            {t("accounting.exempt.toRenew", { year: anneePrecedente(annee), count: aReconduire.length })}
          </p>
          {aReconduire.map((e) => (
            <div key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12.5 }}>
              <span style={{ flex: 1 }}>
                {nomComplet(e)} · {e.classe} — {resumeExonerationAffiche({ exoneration: (e.historique || {})[anneePrecedente(annee)].exoneration })}
                <Identite eleve={e} bloc />
              </span>
              <Btn sm v="amber" disabled={enCours} onClick={() => reconduire(e)}>{t("accounting.exempt.renew")}</Btn>
            </div>
          ))}
        </div>
      )}

      <p style={{ ...titreBloc, margin: "0 0 6px" }}>
        {t("accounting.exempt.inProgress", { count: exoneres.length })}
      </p>
      {exoneres.length === 0
        ? <p style={{ fontSize: 12.5, color: "#94a3b8" }}>{t("accounting.exempt.none")}</p>
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
                      <td style={{ padding: "7px 6px" }}>{resumeExonerationAffiche(e)}</td>
                      <td style={{ padding: "7px 6px", color: "#475569" }}>
                        {libelleMotifAffiche(exo.motif)}{exo.precision ? ` — ${exo.precision}` : ""}
                      </td>
                      <td style={{ padding: "7px 6px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {exo.accordeePar || "—"}{exo.accordeeLe ? ` · ${exo.accordeeLe}` : ""}
                      </td>
                      <td style={{ padding: "7px 6px", textAlign: "end" }}>
                        {estDirection && <Btn sm v="ghost" disabled={enCours} onClick={() => retirer(e)}>{t("accounting.exempt.remove")}</Btn>}
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
