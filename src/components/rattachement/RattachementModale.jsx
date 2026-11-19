import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Btn, Card, Chargement, Input, Modale, Selec } from "../ui";
import { libelleSection } from "../../i18n/libelles";
import { numeroNational } from "../../comptes-parents.js";
import { getPeriodesForSection } from "../../period-utils";
import { groupeDeSection } from "../migration-periodes/migration-periodes-utils";
import {
  accepterRattachement, apercuRattachement, donneesEcolePourRattachement, refuserRattachement,
} from "../../backend/rattachement-supabase";
import {
  bilanPrevu, compteProbable, construireAcceptation, decouperNom, erreurAcceptation,
  periodesEtrangeres, proposerClasse, proposerEleves, proposerMatiere, sectionPrincipale,
} from "./rattachement";

const SECTIONS = ["prescolaire", "primaire", "college", "lycee"];
const cleClasse = (c) => `${c.section}|${c.nom}`;
const nomEleve = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim() || "?";
const parNom = (a, b) => nomEleve(a).localeCompare(nomEleve(b));

// ══════════════════════════════════════════════════════════════
//  Direction : examiner une demande de rattachement (étape 3)
// ══════════════════════════════════════════════════════════════
// Un enseignant de l'école apporte ses classes, ses élèves et ses notes
// saisis dans son espace personnel. La direction relie chacun de ses élèves
// à un élève de l'école (proposé quand le nom correspond) ou le laisse de
// côté, relie les matières, choisit son compte, puis accepte : ses notes,
// absences et appréciations passent alors chez l'école, et son espace est
// fermé (Edge account-manage, accepter_rattachement).
export function RattachementModale({ demande, fermer, onTraitee }) {
  const { t } = useTranslation();
  const { schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const [etat, setEtat] = useState({ chargement: true, erreur: "" });
  const [apercu, setApercu] = useState(null);
  const [ecole, setEcole] = useState(null);
  const [choixClasses, setChoixClasses] = useState({});
  const [choixEleves, setChoixEleves] = useState({});
  const [choixMatieres, setChoixMatieres] = useState({});
  const [compte, setCompte] = useState({ mode: "nouveau", compteId: "", nom: "", prenom: "", section: "", matiere: "" });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState(null);

  const numero = numeroNational(demande.telephone) || "";

  // Élèves de l'école d'une classe, par section et nom.
  const elevesDe = (donnees, section, classe) => (donnees?.eleves || [])
    .filter((e) => e.section === section && e.classe === classe).sort(parNom);

  useEffect(() => {
    let actif = true;
    Promise.all([apercuRattachement(demande.id), donneesEcolePourRattachement()])
      .then(([a, d]) => {
        if (!actif) return;
        const classes = {};
        const eleves = {};
        for (const c of a.classes || []) {
          const nom = proposerClasse(c, d.classes);
          classes[cleClasse(c)] = nom;
          Object.assign(eleves, proposerEleves(c.eleves, nom ? elevesDe(d, c.section, nom) : []));
        }
        const matieres = Object.fromEntries((a.matieres || []).map((m) => [m.nom, proposerMatiere(m.nom, d.matieres)]));
        const probable = compteProbable(d.comptes, { login: numero, nom: demande.enseignant });
        const choisies = (a.classes || []).filter((c) => classes[cleClasse(c)])
          .map((c) => ({ section: c.section, poids: (c.eleves || []).length }));
        const { nom, prenom } = decouperNom(demande.enseignant);
        setApercu(a);
        setEcole(d);
        setChoixClasses(classes);
        setChoixEleves(eleves);
        setChoixMatieres(matieres);
        setCompte({
          mode: probable ? "existant" : "nouveau", compteId: probable?.id || "",
          nom, prenom, section: sectionPrincipale(choisies, a.classes?.[0]?.section || ""), matiere: "",
        });
        setEtat({ chargement: false, erreur: "" });
      })
      .catch((err) => actif && setEtat({ chargement: false, erreur: err?.message || String(err) }));
    return () => { actif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande.id]);

  // Changer la classe de l'école d'une de ses classes : ses élèves sont
  // reproposés dans la nouvelle classe.
  const choisirClasse = (c, nom) => {
    setChoixClasses((x) => ({ ...x, [cleClasse(c)]: nom }));
    const proposes = proposerEleves(c.eleves, nom ? elevesDe(ecole, c.section, nom) : []);
    setChoixEleves((x) => ({ ...x, ...proposes }));
  };

  const corps = useMemo(() => construireAcceptation({
    apercu, choixClasses, choixEleves, choixMatieres,
    compte: compte.mode === "existant" ? { compteId: compte.compteId } : compte,
  }), [apercu, choixClasses, choixEleves, choixMatieres, compte]);
  const prevu = bilanPrevu(apercu, choixEleves, choixMatieres);
  const periodesEcole = [...new Set(corps.classes.flatMap((c) =>
    getPeriodesForSection(schoolInfo, groupeDeSection(c.section) || "secondaire", moisAnnee)))];
  const etrangeres = periodesEtrangeres(apercu?.periodes || [], periodesEcole);
  const comptesEnseignants = (ecole?.comptes || []).slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  const secondaire = compte.section === "college" || compte.section === "lycee";

  const accepter = async () => {
    const e = erreurAcceptation(corps, t);
    if (e) { setErreur(e); return; }
    if (!window.confirm(t("rattachement.acceptConfirm", { enseignant: demande.enseignant }))) return;
    setEnCours(true);
    setErreur("");
    try {
      const r = await accepterRattachement(demande.id, corps);
      setBilan(r.bilan || {});
    } catch (err) {
      setErreur(err?.message || String(err));
    } finally {
      setEnCours(false);
    }
  };

  const refuser = async () => {
    if (!window.confirm(t("rattachement.refuseConfirm", { enseignant: demande.enseignant }))) return;
    setEnCours(true);
    try {
      await refuserRattachement(demande.id);
      toast(t("rattachement.refusedDone"), "success");
      onTraitee();
    } catch (err) {
      setErreur(err?.message || String(err));
      setEnCours(false);
    }
  };

  const titre = `📥 ${t("rattachement.reviewTitle", { enseignant: demande.enseignant })}`;

  if (bilan) {
    return (
      <Modale titre={titre} fermer={onTraitee}>
        <p role="status" style={{ fontSize: 13.5, color: "var(--lc-text)", lineHeight: 1.55, margin: "0 0 10px", fontWeight: 700 }}>
          ✅ {t("rattachement.doneTitle", { enseignant: demande.enseignant })}
        </p>
        <ul style={{ fontSize: 13, color: "var(--lc-text)", margin: 0, paddingInlineStart: 18, lineHeight: 1.6 }}>
          <li>{t("rattachement.doneNotes", { count: bilan.notes?.copiees || 0, deja: bilan.notes?.dejaPresentes || 0 })}</li>
          <li>{t("rattachement.doneOthers", { absences: bilan.absences || 0, appreciations: bilan.appreciations || 0 })}</li>
          <li>{t("rattachement.doneAccount", { login: bilan.login || numero })}</li>
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <Btn onClick={onTraitee}>{t("common.close")}</Btn>
        </div>
      </Modale>
    );
  }

  return (
    <Modale titre={titre} fermer={enCours ? () => {} : fermer} large>
      {etat.chargement ? <Chargement /> : etat.erreur ? (
        <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{etat.erreur}</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ fontSize: 13, color: "var(--lc-text)", margin: 0, lineHeight: 1.55 }}>
            {t("rattachement.reviewIntro", {
              enseignant: demande.enseignant, etablissement: demande.etablissement,
              notes: apercu.totaux?.notes || 0, absences: apercu.totaux?.absences || 0,
            })}
          </p>

          {/* Son compte dans l'école */}
          <Card style={{ padding: 14 }}>
            <strong style={{ fontSize: 13.5, color: "var(--lc-text)" }}>👤 {t("rattachement.accountTitle")}</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="compte-rattachement" checked={compte.mode === "nouveau"}
                  onChange={() => setCompte((c) => ({ ...c, mode: "nouveau" }))} disabled={enCours} />
                {t("rattachement.accountNew", { login: numero || "—" })}
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: comptesEnseignants.length ? "pointer" : "not-allowed" }}>
                <input type="radio" name="compte-rattachement" checked={compte.mode === "existant"}
                  onChange={() => setCompte((c) => ({ ...c, mode: "existant", compteId: c.compteId || comptesEnseignants[0]?.id || "" }))}
                  disabled={enCours || !comptesEnseignants.length} />
                {t("rattachement.accountExisting")}
              </label>
            </div>
            {compte.mode === "existant" ? (
              <div style={{ marginTop: 10 }}>
                <Selec label={t("rattachement.accountPick")} aria-label={t("rattachement.accountPick")}
                  value={compte.compteId} onChange={(e) => setCompte((c) => ({ ...c, compteId: e.target.value }))} disabled={enCours}>
                  {comptesEnseignants.map((c) => <option key={c.id} value={c.id}>{c.nom || c.login} ({c.login})</option>)}
                </Selec>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginTop: 10 }}>
                <Input label={t("rattachement.lastName")} aria-label={t("rattachement.lastName")} value={compte.nom}
                  onChange={(e) => setCompte((c) => ({ ...c, nom: e.target.value }))} disabled={enCours} />
                <Input label={t("rattachement.firstName")} aria-label={t("rattachement.firstName")} value={compte.prenom}
                  onChange={(e) => setCompte((c) => ({ ...c, prenom: e.target.value }))} disabled={enCours} />
                <Selec label={t("rattachement.section")} aria-label={t("rattachement.section")} value={compte.section}
                  onChange={(e) => setCompte((c) => ({ ...c, section: e.target.value }))} disabled={enCours}>
                  <option value="">—</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{libelleSection(s)}</option>)}
                </Selec>
                {secondaire && (
                  <Selec label={t("rattachement.subject")} aria-label={t("rattachement.subject")} value={compte.matiere}
                    onChange={(e) => setCompte((c) => ({ ...c, matiere: e.target.value }))} disabled={enCours}>
                    <option value="">—</option>
                    {(ecole?.matieres || []).map((m) => <option key={m} value={m}>{m}</option>)}
                  </Selec>
                )}
              </div>
            )}
          </Card>

          {/* Ses classes et ses élèves */}
          {(apercu.classes || []).map((c) => {
            const nomEcole = choixClasses[cleClasse(c)] || "";
            const classesSection = (ecole?.classes || []).filter((k) => k.section === c.section)
              .sort((a, b) => a.nom.localeCompare(b.nom));
            const elevesEcole = nomEcole ? elevesDe(ecole, c.section, nomEcole) : [];
            const pris = new Set(Object.values(choixEleves).filter(Boolean));
            return (
              <Card key={cleClasse(c)} style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong style={{ fontSize: 13.5, color: "var(--lc-text)" }}>🏫 {c.nom}</strong>
                    <div style={{ fontSize: 11.5, color: "var(--lc-text-muted, #64748b)" }}>
                      {libelleSection(c.section)} · {t("shell.myClasses.students", { count: (c.eleves || []).length })}
                    </div>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <Selec label={t("rattachement.schoolClass")} aria-label={t("rattachement.classFor", { classe: c.nom })}
                      value={nomEcole} onChange={(e) => choisirClasse(c, e.target.value)} disabled={enCours}>
                      <option value="">{t("rattachement.leaveAside")}</option>
                      {classesSection.map((k) => <option key={k.id} value={k.nom}>{k.nom}</option>)}
                    </Selec>
                  </div>
                </div>
                {!nomEcole ? (
                  <p style={{ fontSize: 12.5, color: "var(--lc-text-muted, #64748b)", margin: 0 }}>{t("rattachement.classAside")}</p>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {(c.eleves || []).map((e) => {
                      const choisi = choixEleves[e.id] || "";
                      return (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: "var(--lc-text)" }}>
                            {nomEleve(e)}
                            <span style={{ color: "var(--lc-text-muted, #64748b)", fontSize: 11.5 }}> · {t("rattachement.notesCount", { count: Number(e.notes) || 0 })}</span>
                          </span>
                          <select aria-label={t("rattachement.studentFor", { nom: nomEleve(e) })} value={choisi} disabled={enCours}
                            onChange={(ev) => setChoixEleves((x) => ({ ...x, [e.id]: ev.target.value }))}
                            style={{
                              minWidth: 200, border: `1.5px solid ${choisi ? "#86efac" : "var(--lc-border)"}`, borderRadius: 8,
                              padding: "6px 9px", fontSize: 12.5, background: "var(--lc-input-bg)", color: "var(--lc-text)",
                            }}>
                            <option value="">{t("rattachement.leaveAside")}</option>
                            {elevesEcole.filter((x) => x.id === choisi || !pris.has(x.id)).map((x) => (
                              <option key={x.id} value={x.id}>{nomEleve(x)}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Matières de ses notes */}
          {(apercu.matieres || []).length > 0 && (
            <Card style={{ padding: 14 }}>
              <strong style={{ fontSize: 13.5, color: "var(--lc-text)" }}>📘 {t("rattachement.subjectsTitle")}</strong>
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {apercu.matieres.map((m) => (
                  <div key={m.nom} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: "var(--lc-text)" }}>
                      {m.nom}
                      <span style={{ color: "var(--lc-text-muted, #64748b)", fontSize: 11.5 }}> · {t("rattachement.notesCount", { count: Number(m.notes) || 0 })}</span>
                    </span>
                    <select aria-label={t("rattachement.subjectFor", { matiere: m.nom })} value={choixMatieres[m.nom] || ""} disabled={enCours}
                      onChange={(ev) => setChoixMatieres((x) => ({ ...x, [m.nom]: ev.target.value }))}
                      style={{ minWidth: 200, border: "1.5px solid var(--lc-border)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, background: "var(--lc-input-bg)", color: "var(--lc-text)" }}>
                      <option value="">{t("rattachement.leaveAside")}</option>
                      {(ecole?.matieres || []).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {etrangeres.length > 0 && (
            <p style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", margin: 0, lineHeight: 1.5 }}>
              ⚠️ {t("rattachement.foreignPeriods", { periodes: etrangeres.join(", ") })}
            </p>
          )}

          <p style={{ fontSize: 12.5, color: "var(--lc-text)", margin: 0, lineHeight: 1.55, fontWeight: 600 }}>
            {t("rattachement.preview", {
              relies: prevu.elevesRelies, laisses: prevu.elevesLaisses, notes: prevu.notesElevesRelies,
            })}
            {prevu.matieresLaissees.length > 0 && ` ${t("rattachement.previewSubjects", { matieres: prevu.matieresLaissees.join(", ") })}`}
          </p>
          <p style={{ fontSize: 12, color: "var(--lc-text-muted, #64748b)", margin: 0, lineHeight: 1.5 }}>
            {t("rattachement.afterAccept")}
          </p>
        </div>
      )}
      {erreur && <p role="alert" style={{ color: "#b91c1c", fontSize: 12.5, margin: "12px 0 0" }}>{erreur}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn v="danger" onClick={refuser} disabled={enCours || etat.chargement}>{t("rattachement.refuse")}</Btn>
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("rattachement.later")}</Btn>
        <Btn v="success" onClick={accepter} disabled={enCours || etat.chargement || !!etat.erreur}>
          {enCours ? t("rattachement.accepting") : `✅ ${t("rattachement.accept")}`}
        </Btn>
      </div>
    </Modale>
  );
}
