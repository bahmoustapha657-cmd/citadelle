import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { C, fmtN, isGroupeActif } from "../../../constants";
import { localeCourante } from "../../../i18n";
import { libelleMois, libelleSectionPaie } from "../../../i18n/libelles";
import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";
import { majReglagesCompta } from "../../../backend/data-supabase";
import { dateDuJour } from "../paiements-journal";
import { agentsPourBon, sectionsPaieProposees } from "../salaires/bon-agents";
import { FeuilleDuJour } from "./FeuilleDuJour";
import { PresenceModale } from "./PresenceModale";
import { ReglagesPresencesModale } from "./ReglagesPresencesModale";
import {
  STATUTS, TYPES_A_JUSTIFIER, TYPES_PRESENCE, joursOuvrables, moisDeDate, recapMois, reglagesPresences,
} from "./presences-utils";

const TYPE = Object.fromEntries(TYPES_PRESENCE.map((t) => [t.id, t]));
const dateFr = (d) => String(d || "").split("-").reverse().join("/");
const fmtJ = (j) => Number(j).toLocaleString(localeCourante(), { maximumFractionDigits: 2 });

// Onglet Comptabilité → Présences : registre des absences, retards,
// permissions… du personnel, décisions (justifiée / injustifiée) et aperçu
// des retenues du mois, reportées sur la paie par « ✔ Appliquer les
// absences » (onglet Salaires).
export function PresencesTab({ c, readOnly }) {
  const { t } = useTranslation();
  const { presences, cPres, ajPres, modPres, supPres, canCreate, canEdit, schoolInfo, toast, salaires } = c;
  const anneeScolaire = c.anneeConsultee;
  const reglages = reglagesPresences(schoolInfo);
  // Mois courant s'il fait partie des mois de paie, sinon le premier.
  const [mois, setMois] = useState(() => {
    const courant = moisDeDate(dateDuJour());
    return c.moisSalaire.includes(courant) ? courant : (c.moisSalaire[0] || "Octobre");
  });
  const [filtre, setFiltre] = useState("tous");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const groupesPaie = {
    secondaire: isGroupeActif(schoolInfo, "secondaire") || presences.some((p) => p.section === "Secondaire"),
    primaire: isGroupeActif(schoolInfo, "primaire") || presences.some((p) => p.section === "Primaire"),
  };
  const sections = sectionsPaieProposees(groupesPaie, form.section);
  const listes = { ensCollege: c.ensCollege, ensLycee: c.ensLycee, ensPrimaire: c.ensPaiePrimaire, personnel: c.personnel };
  const agentsFeuille = sectionsPaieProposees(groupesPaie)
    .flatMap((section) => agentsPourBon(section, listes).map((nom) => ({ nom, section })));

  const duMois = presences.filter((p) => moisDeDate(p.date) === mois);
  const affiches = duMois
    .filter((p) => filtre === "tous" || (filtre === "en_attente" ? TYPES_A_JUSTIFIER.has(p.type) && (p.statut || "en_attente") === "en_attente" : p.type === filtre))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.agentNom).localeCompare(String(b.agentNom), "fr"));
  const nbAttente = duMois.filter((p) => TYPES_A_JUSTIFIER.has(p.type) && (p.statut || "en_attente") === "en_attente").length;
  const recap = recapMois({
    presences, salairesMois: salaires.filter((s) => s.mois === mois), mois, anneeScolaire, reglages,
    retenueSecondaire: c.salairesDomaine?.retenueSecondaire,
  });
  const ouvrables = joursOuvrables(mois, anneeScolaire, reglages.joursTravail);

  const peutSaisir = canCreate && !readOnly;
  const peutDecider = canEdit && !readOnly;
  const trace = () => ({ decidePar: c.auteur || "", decideLe: new Date().toISOString() });

  const ouvrirNouveau = () => {
    setForm({ date: dateDuJour(), section: sections[0], agentNom: "", type: "absence", duree: "journee", statut: "en_attente", motif: "" });
    setModal("saisie");
  };
  const enregistrer = async () => {
    const { _id, ...champs } = form;
    const fait = {
      ...champs,
      duree: champs.type === "absence" ? (champs.duree || "journee") : undefined,
      statut: TYPES_A_JUSTIFIER.has(champs.type) ? (champs.statut || "en_attente") : "autorise",
    };
    try {
      if (_id) {
        const avant = presences.find((p) => p._id === _id);
        await modPres({ ...fait, _id, ...(avant?.statut !== fait.statut ? trace() : {}) });
      } else {
        await ajPres({ ...fait, annee: c.anneeCourante, saisiPar: c.auteur || "", ...(fait.statut !== "en_attente" ? trace() : {}) });
      }
      setModal(null);
      toast(t("accounting.att.saved"), "success");
    } catch (e) {
      toast(t("accounting.att.saveFailed", { error: e.message }), "error");
    }
  };
  const decider = async (p, statut) => {
    try { await modPres({ ...p, statut, ...trace() }); } catch (e) { toast(t("accounting.att.decisionFailed", { error: e.message }), "error"); }
  };
  const enregistrerFeuille = async (date, faits) => {
    try {
      for (const f of faits) {
        await ajPres({
          date, section: f.section, agentNom: f.nom, type: f.type,
          ...(f.type === "absence" ? { duree: "journee" } : {}),
          statut: "en_attente", motif: "", annee: c.anneeCourante, saisiPar: c.auteur || "", origine: "feuille",
        });
      }
      toast(t("accounting.att.sheetSaved", { count: faits.length }), "success");
      setModal(null);
    } catch (e) {
      toast(t("accounting.att.sheetPartial", { error: e.message }), "error");
    }
  };
  const enregistrerReglages = async (r) => {
    try {
      await majReglagesCompta({ reglagesPresences: r });
      toast(t("accounting.att.settingsSaved"), "success");
      setModal(null);
    } catch (e) {
      toast(t("accounting.att.settingsFailed", { error: e.message }), "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <strong style={{ fontSize: 14, color: C.blueDark }}>{t("accounting.att.title")}</strong>
        {nbAttente > 0 && <Badge color="amber">{t("accounting.att.pendingBadge", { count: nbAttente })}</Badge>}
        <div style={{ flex: 1 }} />
        <select value={mois} onChange={(e) => setMois(e.target.value)} aria-label={t("accounting.month")}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 12px", fontSize: 13, background: "#fff", color: C.blueDark, fontWeight: 700 }}>
          {c.moisSalaire.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
        </select>
        {peutSaisir && <Btn v="vert" onClick={() => setModal("feuille")}>{t("accounting.att.dailySheetBtn")}</Btn>}
        {peutSaisir && <Btn onClick={ouvrirNouveau}>{t("accounting.att.enterBtn")}</Btn>}
        {peutDecider && <Btn v="ghost" onClick={() => setModal("reglages")} title={t("accounting.att.settingsHint")}>⚙️</Btn>}
      </div>

      <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 12.5, color: "#1e3a8a", marginBottom: 12 }}>
        <Trans i18nKey="accounting.att.rule"
          values={{ days: ouvrables || "?", month: libelleMois(mois), lates: reglages.retardsParDemiJournee }}
          components={{ b: <strong />, i: <em /> }} />
      </div>

      {cPres ? <Chargement /> : <>
        {recap.length > 0 && <Card style={{ marginBottom: 14 }}><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={[t("accounting.att.cols.agent"), t("accounting.section"), t("accounting.att.cols.absUnexc"), t("accounting.att.cols.lateUnexc"), t("accounting.att.status.en_attente"), t("accounting.att.cols.calcDeduction"), t("accounting.att.cols.onPayroll")]} />
          <tbody>{recap.map((r) => {
            const aAppliquer = r.retenue !== null && r.appliquee !== null && r.retenue !== r.appliquee;
            return (
              <TR key={`${r.section}|${r.nom}`}>
                <TD bold>{r.nom}</TD>
                <TD><Badge color={r.section === "Personnel" ? "purple" : r.section === "Primaire" ? "vert" : "blue"}>{libelleSectionPaie(r.section)}</Badge></TD>
                <TD center>{r.joursAbsence ? t("accounting.att.daysShort", { n: fmtJ(r.joursAbsence) }) : "—"}</TD>
                <TD center>{r.retards ? `${r.retards}${r.joursRetards ? ` (= ${t("accounting.att.daysShort", { n: fmtJ(r.joursRetards) })})` : ""}` : "—"}</TD>
                <TD center>{r.enAttente ? <Badge color="amber">{r.enAttente}</Badge> : "—"}</TD>
                <TD center style={{ color: "#b91c1c", fontWeight: 700 }}>
                  {!r.fiche ? <span style={{ fontWeight: 400, color: "#64748b", fontSize: 12 }}>{t("accounting.att.payNotGenerated")}</span>
                    : r.retenue === null ? <span style={{ fontWeight: 400, color: "#64748b", fontSize: 12 }}>{t("accounting.att.teacherNotFound")}</span>
                      : r.retenue ? `-${fmtN(r.retenue)}` : "0"}
                </TD>
                <TD center>{r.appliquee === null ? "—"
                  : aAppliquer ? <Badge color="orange">{t("accounting.att.toApply")}</Badge>
                    : r.appliquee ? <Badge color="green">✔ {fmtN(r.appliquee)}</Badge> : "—"}</TD>
              </TR>
            );
          })}</tbody>
        </table></div></Card>}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ id: "tous", label: t("accounting.att.filterAll", { count: duMois.length }) }, { id: "en_attente", label: t("accounting.att.filterPending", { count: nbAttente }) },
            ...TYPES_PRESENCE.map((ty) => ({ id: ty.id, label: `${ty.icone} ${ty.label}` }))].map((f) => (
            <button key={f.id} type="button" onClick={() => setFiltre(f.id)} style={{
              padding: "5px 12px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: filtre === f.id ? C.blueDark : "#e0ebf8", color: filtre === f.id ? "#fff" : C.blueDark,
            }}>{f.label}</button>
          ))}
        </div>

        {affiches.length === 0 ? <Vide icone="🕘" msg={t("accounting.att.nothingFor", { month: libelleMois(mois) })} />
          : <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <THead cols={[t("accounting.att.cols.agent"), t("common.date"), t("accounting.att.cols.type"), t("accounting.att.cols.decision"), t("accounting.bon.reason"), t("common.actions")]} />
            <tbody>{affiches.map((p) => {
              const ty = TYPE[p.type] || { label: p.type, icone: "" };
              const aJustifier = TYPES_A_JUSTIFIER.has(p.type);
              const statut = STATUTS[p.statut || "en_attente"];
              return (
                <TR key={p._id}>
                  <TD bold>{p.agentNom}<div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{libelleSectionPaie(p.section)}</div></TD>
                  <TD>{dateFr(p.date)}</TD>
                  <TD>{ty.icone} {ty.label}{p.type === "absence" && p.duree === "demi" ? ` ${t("accounting.att.halfDayShort")}` : ""}</TD>
                  <TD>{aJustifier
                    ? <span title={p.decidePar ? t("accounting.att.decidedBy", { name: p.decidePar }) : ""}><Badge color={statut.couleur}>{statut.label}</Badge></span>
                    : <Badge color="gray">{t("accounting.att.authorized")}</Badge>}</TD>
                  <TD><span style={{ fontSize: 12 }}>{p.motif || "—"}</span></TD>
                  <TD><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {peutDecider && aJustifier && p.statut !== "justifiee" && <Btn sm v="success" onClick={() => decider(p, "justifiee")} title={t("accounting.att.excusedHint")}>{t("accounting.att.excusedBtn")}</Btn>}
                    {peutDecider && aJustifier && p.statut !== "injustifiee" && <Btn sm v="red" onClick={() => decider(p, "injustifiee")} title={t("accounting.att.unexcusedHint")}>{t("accounting.att.unexcusedBtn")}</Btn>}
                    {peutDecider && <Btn sm v="ghost" onClick={() => { setForm({ ...p }); setModal("saisie"); }}>✏️</Btn>}
                    {peutDecider && <Btn sm v="ghost" onClick={() => { if (confirm(t("accounting.att.deleteLine"))) supPres(p._id); }}>🗑</Btn>}
                  </div></TD>
                </TR>
              );
            })}</tbody>
          </table></div></Card>}
      </>}

      {modal === "saisie" && <PresenceModale form={form} setForm={setForm} fermer={() => setModal(null)} enregistrer={enregistrer}
        sections={sections} listes={listes} nouveau={!form._id} />}
      {modal === "feuille" && <FeuilleDuJour agents={agentsFeuille} presences={presences} dateInitiale={dateDuJour()}
        fermer={() => setModal(null)} enregistrer={enregistrerFeuille} />}
      {modal === "reglages" && <ReglagesPresencesModale reglages={reglages} fermer={() => setModal(null)} enregistrer={enregistrerReglages} />}
    </div>
  );
}
