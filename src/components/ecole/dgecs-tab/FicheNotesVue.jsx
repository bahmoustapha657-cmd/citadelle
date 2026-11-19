import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Btn, Vide } from "../../ui";
import { PERIODE_ANNEE, ficheNotesDgecs, normaliserMatricule } from "../../../dgecs";
import { imprimerFicheNotesDgecs } from "../../../reports/dgecs-print";

const champ = { border: "1px solid var(--lc-border)", borderRadius: 7, padding: "6px 10px", fontSize: 12, background: "var(--lc-input-bg)", color: "var(--lc-text)" };
const cellule = { padding: "7px 9px", borderBottom: "1px solid var(--lc-border-soft)", fontSize: 12.5, verticalAlign: "middle" };
const entete = { padding: "8px 9px", fontSize: 10, fontWeight: 700, color: "#fff", textAlign: "center", background: "var(--sc1)", position: "sticky", top: 0 };

// Matricule donné par la plateforme : saisi ici, enregistré sur la fiche
// de l'élève (champ IEN) quand on quitte la case. `modifierChamp` et non
// `modifier`, qui ne fait rien hors ligne.
function MatriculeCase({ eleve, matricule, modifierChamp, toast }) {
  const { t } = useTranslation();
  const [valeur, setValeur] = useState(matricule);
  const [enCours, setEnCours] = useState(false);
  // Matricule changé ailleurs (autre poste, synchronisation) : la case suit.
  const [precedent, setPrecedent] = useState(matricule);
  if (precedent !== matricule) { setPrecedent(matricule); setValeur(matricule); }
  const enregistrer = async () => {
    const propre = normaliserMatricule(valeur);
    setValeur(propre);
    if (propre === matricule) return;
    setEnCours(true);
    try {
      await modifierChamp(eleve._id, { ien: propre });
      toast?.(t("dgecs.notes.matriculeSaved", { name: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim() }), "success");
    } catch (e) {
      setValeur(matricule);
      toast?.(t("dgecs.notes.matriculeError", { error: e?.message || e }), "error");
    } finally {
      setEnCours(false);
    }
  };
  return (
    <input value={valeur} disabled={enCours} onChange={(e) => setValeur(e.target.value)} onBlur={enregistrer}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      placeholder={t("dgecs.notes.matriculePlaceholder")} aria-label={t("dgecs.notes.colMatricule")}
      style={{ ...champ, width: 130, fontFamily: "monospace", fontWeight: 700, borderColor: valeur ? "var(--lc-border)" : "#f87171" }} />
  );
}

export function FicheNotesVue({
  eleves = [], notes = [], matieresForClasse, periodes = [], classesUniq = [], schoolInfo = {}, annee = "",
  maxNote = 20, canEdit = false, modChampE = null, toast, filtreClasse = "all",
}) {
  const { t } = useTranslation();
  const [classe, setClasse] = useState(filtreClasse !== "all" && classesUniq.includes(filtreClasse) ? filtreClasse : classesUniq[0] || "");
  const [periode, setPeriode] = useState(PERIODE_ANNEE);
  const matieres = useMemo(() => (classe ? matieresForClasse(classe) : []), [matieresForClasse, classe]);
  const fiche = useMemo(
    () => ficheNotesDgecs({ eleves, notes, matieres, periodes, periode, classe }),
    [eleves, notes, matieres, periodes, periode, classe],
  );
  const periodeLibelle = periode === PERIODE_ANNEE ? t("dgecs.wholeYear") : periode;
  const peutSaisir = canEdit && !!modChampE;

  if (!classesUniq.length) return <Vide icone="🏫" msg={t("dgecs.noClass")} />;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>{t("dgecs.class")}{" "}
          <select value={classe} onChange={(e) => setClasse(e.target.value)} style={champ}>
            {classesUniq.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>{t("dgecs.period")}{" "}
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={champ}>
            <option value={PERIODE_ANNEE}>{t("dgecs.wholeYear")}</option>
            {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <Btn sm v="ghost" disabled={!fiche.lignes.length || !matieres.length}
          onClick={() => imprimerFicheNotesDgecs(fiche, { schoolInfo, annee, periodeLibelle, maxNote })}>{t("dgecs.print")}</Btn>
      </div>

      {!fiche.lignes.length ? <Vide icone="🎓" msg={t("dgecs.noStudents")} />
        : !matieres.length ? <Vide icone="📚" msg={t("dgecs.notes.noSubjects")} />
          : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <Badge color="blue">{t("dgecs.notes.students", { count: fiche.lignes.length })}</Badge>
                <Badge color={fiche.sansMatricule ? "red" : "green"}>{t("dgecs.notes.withoutMatricule", { count: fiche.sansMatricule })}</Badge>
                <Badge color={fiche.notesManquantes ? "red" : "green"}>{t("dgecs.notes.missing", { count: fiche.notesManquantes })}</Badge>
                {periode === PERIODE_ANNEE && <Badge color={fiche.notesIncompletes ? "amber" : "green"}>{t("dgecs.notes.incomplete", { count: fiche.notesIncompletes })}</Badge>}
                {fiche.doublons.length > 0 && <Badge color="red">{t("dgecs.notes.duplicates", { list: fiche.doublons.join(", ") })}</Badge>}
              </div>
              <div role="status" style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 8,
                background: fiche.pret ? "rgba(16,185,129,0.10)" : "rgba(245,158,11,0.10)",
                border: `1px solid ${fiche.pret ? "#6ee7b7" : "#fcd34d"}`, color: fiche.pret ? "#065f46" : "#92400e",
              }}>
                {t(fiche.pret ? "dgecs.notes.ready" : "dgecs.notes.notReady")}
                {fiche.periodesVides.length > 0 && <div style={{ marginTop: 4 }}>{t("dgecs.notes.emptyPeriods", { list: fiche.periodesVides.join(", ") })}</div>}
              </div>
              <p style={{ fontSize: 11.5, color: "var(--lc-text-faint)", margin: "0 0 8px" }}>{t("dgecs.notes.matriculeHint")}</p>
              <div style={{ overflowX: "auto", border: "1px solid var(--lc-border)", borderRadius: 10 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420 + 90 * matieres.length }}>
                  <thead><tr>
                    <th style={entete}>{t("dgecs.notes.colNumber")}</th>
                    <th style={entete}>{t("dgecs.notes.colMatricule")}</th>
                    <th style={{ ...entete, textAlign: "start" }}>{t("dgecs.notes.colName")}</th>
                    {fiche.matieres.map((m) => (
                      <th key={m.nom} style={entete}>{m.titre}<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>{t("dgecs.notes.coef", { coef: m.coefficient })} · /{maxNote}</span></th>
                    ))}
                    <th style={entete}>{t("dgecs.notes.colMissing")}</th>
                  </tr></thead>
                  <tbody>{fiche.lignes.map((l) => (
                    <tr key={l.eleve._id}>
                      <td style={{ ...cellule, textAlign: "center", color: "var(--lc-text-muted)" }}>{l.numero}</td>
                      <td style={cellule}>{peutSaisir
                        ? <MatriculeCase eleve={l.eleve} matricule={l.matricule} modifierChamp={modChampE} toast={toast} />
                        : <span style={{ fontFamily: "monospace", fontWeight: 700, color: l.matricule ? "var(--lc-text)" : "#dc2626" }}>{l.matricule || "—"}</span>}</td>
                      <td style={{ ...cellule, fontWeight: 700 }}>{l.nom}</td>
                      {l.cellules.map((c, i) => (
                        <td key={fiche.matieres[i].nom} title={c.valeur === null ? t("dgecs.notes.missingCell") : c.incomplete ? t("dgecs.notes.incompleteCell") : undefined}
                          style={{
                            ...cellule, textAlign: "center", fontFamily: "monospace", fontSize: 13.5, fontWeight: 700,
                            background: c.valeur === null ? "rgba(239,68,68,0.12)" : c.incomplete ? "rgba(245,158,11,0.14)" : "transparent",
                          }}>{c.valeur === null ? "—" : `${c.texte}${c.incomplete ? "*" : ""}`}</td>
                      ))}
                      <td style={{ ...cellule, textAlign: "center" }}>{l.manquantes ? <Badge color="red">{l.manquantes}</Badge> : "✓"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
    </div>
  );
}
