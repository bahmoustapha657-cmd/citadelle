import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtN, getMonnaie, getSectionLabelForClasse } from "../../../constants";
import { majReglagesCompta } from "../../../backend/data-supabase";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { Btn, Input, Modale } from "../../ui";
import {
  exportExcel, imprimerAlerteMensualites, imprimerListeNonReinscrits,
} from "../../../reports";
import { MOIS_GARANTIE_MAX, moisDeGarantie, moisGarantieEcole } from "../../../paiements-scolarite";
import {
  JOUR_ECHEANCE_MAX, SEUIL_MOIS_MAX, elevesAyantPaye, elevesEnRetard, elevesNonReinscrits, reglagesAlerte,
} from "./alerte-mensualites";
import {
  DELAI_RETRAIT_MAX, dateRetraitNonReinscrits, delaiRetraitEcole, ecarterNonReinscrits, estNonReinscritSansPaiement,
  formaterDateRetrait, reglageEcartes, regleEcartement,
} from "../../../ecartes-non-reinscrits";
import { EcarterModale } from "./EcarterModale";
import { ListePayesModale } from "./ListePayesModale";
import { PreavisModale } from "./PreavisModale";

// Alertes des élèves en retard sur des mois DÉJÀ ÉCHUS (jour d'échéance,
// seuil et mois de garantie réglés par la comptabilité ; les mois de
// garantie — derniers de l'année — sont dus dès la rentrée). Repliées derrière un bouton cliquable ;
// suivent le filtre cycle + classe (via `eleves`, déjà filtré).
// `annee` : année scolaire affichée — les mois d'après un départ ne comptent pas.
// `perimetre` : section / classe affichées, reprises sur la fiche imprimée.
// `classe` : classe filtrée (vide = toutes), proposée d'office pour écarter.
// Les non réinscrits (aucun paiement de l'année) retirés des classes — par
// le retrait automatique, ou classe par classe avant lui — sortent de
// l'alerte, des préavis et des listes, comme du module École et du portail
// enseignant (ecartes-non-reinscrits.js). Leur fiche n'est pas modifiée ;
// RappelNonReinscrits les rappelle au comptable.
export function AlertesCritiques({ eleves: tousEleves, moisAnnee, annee, tarifsClasses, schoolInfo, canEdit, toast, perimetre, classe = "" }) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);
  const [reglant, setReglant] = useState(false);
  // Élèves à qui remettre un préavis de renvoi : toute la liste, ou un seul.
  const [preavis, setPreavis] = useState(null);
  // Fenêtre de classement de la liste « Ont payé », avant impression.
  const [classerPayes, setClasserPayes] = useState(false);
  // Classes écartées de l'année : réglage de l'ÉCOLE, partagé par tous les
  // postes (chefs de section, enseignants), écrit par maj_reglages_compta.
  const { setSchoolInfo } = useContext(SchoolContext);
  const regleRetrait = useMemo(() => regleEcartement(schoolInfo, annee), [schoolInfo, annee]);
  const classesEcartees = regleRetrait.classes;
  const changerClassesEcartees = async (classes) => {
    try {
      const enregistre = await majReglagesCompta({ ecartesNonReinscrits: reglageEcartes(schoolInfo, annee, classes) });
      // Effet immédiat ici ; les autres postes le reçoivent au chargement de l'école.
      setSchoolInfo?.((prec) => ({ ...prec, ...enregistre }));
      toast?.(classes.length > classesEcartees.length
        ? t("accounting.alert.excludedAll") : t("accounting.alert.shownAgainAll"), "success");
    } catch (e) {
      toast?.(t("accounting.alert.settingNotSaved", { error: e.message }), "error");
    }
  };
  const [ecartant, setEcartant] = useState(false);
  const { gardes: eleves, ecartes } = useMemo(() => ecarterNonReinscrits(tousEleves, regleRetrait), [tousEleves, regleRetrait]);
  const nbAEcarter = tousEleves.filter(estNonReinscritSansPaiement).length;
  const { jourEcheance, seuilMois } = reglagesAlerte(schoolInfo);
  const moisGarantie = moisGarantieEcole(schoolInfo);
  const delaiRetrait = delaiRetraitEcole(schoolInfo);
  const reglages = useMemo(() => ({ jourEcheance, seuilMois, moisGarantie, delaiRetrait }), [jourEcheance, seuilMois, moisGarantie, delaiRetrait]);
  const garantie = moisDeGarantie(moisAnnee, moisGarantie);
  const retards = useMemo(
    () => elevesEnRetard(eleves, { moisAnnee, annee, tarifsClasses, reglages, moisGarantie: reglages.moisGarantie }),
    [eleves, moisAnnee, annee, tarifsClasses, reglages],
  );
  const monnaie = schoolInfo?.monnaie || getMonnaie();
  const total = retards.reduce((s, r) => s + r.montant, 0);
  // Listes imprimables, même périmètre que l'alerte : élèves ayant payé
  // (et leurs mois), élèves présents sans inscription encaissée (les non
  // réinscrits retirés ont leur propre liste, dans RappelNonReinscrits).
  const listes = useMemo(() => ({
    payes: elevesAyantPaye(eleves, { moisAnnee, tarifsClasses }),
    nonReinscrits: elevesNonReinscrits(eleves, { moisAnnee, tarifsClasses }),
  }), [eleves, moisAnnee, tarifsClasses]);
  const optionsListe = { schoolInfo, annee, perimetre, moisAnnee };
  const modaleListePayes = classerPayes && (
    <ListePayesModale lignes={listes.payes} options={optionsListe} monnaie={monnaie} fermer={() => setClasserPayes(false)} />
  );
  const boutonsListes = (
    <>
      <Btn sm v="ghost" disabled={!listes.payes.length} title={t("accounting.alert.printPaidHint")}
        onClick={() => setClasserPayes(true)}>✅ {t("accounting.alert.havePaid", { count: listes.payes.length })}</Btn>
      <Btn sm v="ghost" disabled={!listes.nonReinscrits.length} title={t("accounting.alert.printNotEnrolledHint")}
        onClick={() => imprimerListeNonReinscrits(listes.nonReinscrits, optionsListe)}>{t("accounting.nonReinscrits.inscriptionNonEncaissee", { n: listes.nonReinscrits.length })}</Btn>
      {/* Écartement manuel, classe par classe : utile AVANT le retrait automatique. */}
      {!regleRetrait.toutes && (canEdit || ecartes.length > 0) && (
        <Btn sm v="ghost" disabled={!nbAEcarter} title={t("accounting.alert.excludeHint")}
          onClick={() => setEcartant(true)}>🚫 {ecartes.length ? t("accounting.alert.excludedCount", { count: ecartes.length }) : t("accounting.alert.exclude")}</Btn>
      )}
    </>
  );
  const modaleEcarter = ecartant && (
    <EcarterModale eleves={tousEleves} classesEcartees={classesEcartees} changerClassesEcartees={changerClassesEcartees}
      classeCourante={classe} peutModifier={canEdit} fermer={() => setEcartant(false)} />
  );

  const enregistrer = async ({ moisGarantie: garantieChoisie, delaiRetrait: delaiChoisi, ...alerte }) => {
    try {
      const enregistre = await majReglagesCompta({
        alerteMensualites: alerte, moisGarantie: garantieChoisie, retraitNonReinscrits: delaiChoisi,
      });
      // Effet immédiat ici (retrait des non réinscrits compris) ; les autres
      // postes le reçoivent par l'abonnement à la fiche de l'école.
      if (enregistre && typeof enregistre === "object") setSchoolInfo?.((prec) => ({ ...prec, ...enregistre }));
      toast?.(t("accounting.alert.settingsSaved"), "success");
      setReglant(false);
    } catch (e) {
      toast?.(t("accounting.alert.settingsNotSaved", { error: e.message }), "error");
    }
  };

  const modale = reglant && <ReglagesAlerteModale reglages={reglages} schoolInfo={schoolInfo} annee={annee}
    fermer={() => setReglant(false)} enregistrer={enregistrer} />;
  const boutonReglages = canEdit && <Btn sm v="ghost" onClick={() => setReglant(true)}>⚙️ {t("accounting.alert.settings")}</Btn>;
  const regle = [
    garantie.length ? t("accounting.alert.ruleGuarantee", { months: garantie.map((m) => t(`months.${m}`, m)).join(t("accounting.alert.and")) }) : "",
    t("accounting.alert.ruleLateFrom", { day: reglages.jourEcheance === 1 ? t("accounting.alert.firstDay") : reglages.jourEcheance }),
    t("accounting.alert.ruleThreshold", { count: reglages.seuilMois }),
  ].filter(Boolean).join(" · ");

  if (retards.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap",
        background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "8px 14px" }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <strong style={{ fontSize: 13, color: "#065f46" }}>{t("accounting.alert.noneLate")}</strong>
        <span style={{ fontSize: 11.5, color: "#047857" }}>({regle})</span>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>{boutonsListes}{boutonReglages}</span>
        {modale}
        {modaleListePayes}
        {modaleEcarter}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" onClick={() => setOuvert((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer", flexWrap: "wrap",
          background: "#fce8e8", border: "1px solid #f5c1c1",
          borderRadius: ouvert ? "10px 10px 0 0" : 10, padding: "10px 14px", textAlign: "start" }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <strong style={{ fontSize: 13, color: "#9b2020" }}>
          {t("accounting.alert.lateSummary", { count: retards.length, amount: fmtN(total), currency: monnaie })}
        </strong>
        <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 700, color: "#9b2020" }}>
          {ouvert ? `▾ ${t("accounting.alert.hide")}` : `▸ ${t("accounting.alert.show")}`}
        </span>
      </button>

      {ouvert && (
        <div style={{ background: "#fff", border: "1px solid #f5c1c1", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: "#6b7280", flex: 1, minWidth: 180 }}>{t("accounting.alert.rule", { rule: regle })}</span>
            {boutonReglages}
            <Btn sm v="ghost" onClick={() => imprimerAlerteMensualites(retards, { schoolInfo, annee, perimetre, regle })}>
              🖨️ {t("common.print")}
            </Btn>
            <Btn sm v="ghost" onClick={() => setPreavis(retards)}>📨 {t("accounting.alert.notice")}</Btn>
            {boutonsListes}
            <Btn sm v="ghost" onClick={() => exportExcel(
              t("reports.excel.files.paymentAlerts"),
              [t("reports.excel.headers.matricule"), t("reports.excel.headers.lastName"), t("reports.excel.headers.firstName"), t("reports.excel.headers.class"), t("reports.excel.headers.level"), t("reports.excel.headers.unpaidMonths"), t("accounting.alert.monthsLate"), t("accounting.alert.remainingDue", { currency: monnaie }), t("reports.excel.headers.guardian"), t("reports.excel.headers.contact")],
              retards.map(({ eleve: e, mois, montant }) => [
                e.matricule || "", e.nom, e.prenom, e.classe, getSectionLabelForClasse(e.classe),
                mois.length, mois.map((m) => t(`months.${m}`, m)).join(", "), montant, e.tuteur || "", e.contactTuteur || "",
              ]),
            )}>📥 {t("common.export")}</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
            {retards.map((retard) => {
              const { eleve: e, mois, montant } = retard;
              return (
              <div key={e._id} style={{ border: "1px solid #f5c1c1", borderRadius: 7, padding: "7px 10px", fontSize: 12, lineHeight: 1.5 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800, color: "#9b2020" }}>{e.nom} {e.prenom}</span>
                    <span style={{ color: "#6b7280" }}> · {e.classe}</span>
                  </span>
                  <button type="button" title={t("accounting.alert.noticeForStudent")} onClick={() => setPreavis([retard])}
                    style={{ border: "1px solid #f5c1c1", background: "#fff", borderRadius: 6, padding: "1px 7px", fontSize: 11.5, cursor: "pointer", color: "#9b2020", whiteSpace: "nowrap" }}>
                    📨 {t("accounting.alert.noticeShort")}
                  </button>
                </div>
                <div>
                  <strong>{t("accounting.alert.monthsCount", { count: mois.length })}</strong> : {mois.map((m) => t(`months.${m}`, m)).join(", ")}
                  {montant > 0 && <strong style={{ color: "#9b2020" }}> — {fmtN(montant)} {monnaie}</strong>}
                </div>
                <div style={{ color: "#475569" }}>
                  👤 {e.tuteur || "—"}
                  {e.contactTuteur
                    ? <> · 📞 <a href={`tel:${String(e.contactTuteur).replace(/[^\d+]/g, "")}`} style={{ color: "#1d4ed8" }}>{e.contactTuteur}</a></>
                    : " · 📞 —"}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
      {modale}
      {modaleListePayes}
      {modaleEcarter}
      {preavis && <PreavisModale retards={preavis} schoolInfo={schoolInfo} annee={annee} monnaie={monnaie} fermer={() => setPreavis(null)} />}
    </div>
  );
}

// Jour à partir duquel un mois non payé compte comme en retard, nombre de
// mois de retard déclenchant l'alerte, et mois de garantie (derniers mois
// payés d'avance — ils passent aussi en tête de l'ordre d'encaissement). Enregistrés dans l'école (RPC
// maj_reglages_compta), mêmes bornes que le serveur.
function ReglagesAlerteModale({ reglages, schoolInfo, annee, fermer, enregistrer }) {
  const { t, i18n } = useTranslation();
  const [jour, setJour] = useState(reglages.jourEcheance);
  const [seuil, setSeuil] = useState(reglages.seuilMois);
  const [garantie, setGarantie] = useState(reglages.moisGarantie);
  const [delai, setDelai] = useState(reglages.delaiRetrait);
  const anneeRetrait = schoolInfo?.anneeScolaire || annee;
  const dateRetrait = (n) => formaterDateRetrait(dateRetraitNonReinscrits(anneeRetrait, schoolInfo?.moisDebut || "Octobre", n), i18n.language);
  const [enCours, setEnCours] = useState(false);
  const j = Number(jour);
  const s = Number(seuil);
  const valide = Number.isInteger(j) && j >= 1 && j <= JOUR_ECHEANCE_MAX
    && Number.isInteger(s) && s >= 1 && s <= SEUIL_MOIS_MAX;
  const valider = async () => {
    setEnCours(true);
    try {
      await enregistrer({ jourEcheance: j, seuilMois: s, moisGarantie: Number(garantie), delaiRetrait: Number(delai) });
    } finally { setEnCours(false); }
  };
  return (
    <Modale titre={`⚙️ ${t("accounting.alert.settingsTitle")}`} fermer={fermer}>
      <Input label={t("accounting.alert.dueDay", { max: JOUR_ECHEANCE_MAX })} type="number" min="1" max={JOUR_ECHEANCE_MAX}
        value={jour} onChange={(e) => setJour(e.target.value)} />
      <div style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 14px" }}>
        {t("accounting.alert.dueDayExample")}
      </div>
      <Input label={t("accounting.alert.thresholdLabel", { max: SEUIL_MOIS_MAX })} type="number" min="1" max={SEUIL_MOIS_MAX}
        value={seuil} onChange={(e) => setSeuil(e.target.value)} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>
        {t("accounting.alert.guaranteeLabel")}
      </label>
      <select value={garantie} onChange={(e) => setGarantie(Number(e.target.value))}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13, width: "100%" }}>
        {Array.from({ length: MOIS_GARANTIE_MAX + 1 }, (_, n) => (
          <option key={n} value={n}>{n === 0 ? t("accounting.alert.guaranteeNone") : n === 1 ? t("accounting.alert.guaranteeLast") : t("accounting.alert.guaranteeLastN", { count: n })}</option>
        ))}
      </select>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
        {t("accounting.alert.guaranteeHint")}
      </div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>
        {t("accounting.nonReinscrits.reglageLibelle")}
      </label>
      <select value={delai} onChange={(e) => setDelai(Number(e.target.value))}
        style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "7px 10px", fontSize: 13, width: "100%" }}>
        {Array.from({ length: DELAI_RETRAIT_MAX + 1 }, (_, n) => (
          <option key={n} value={n}>
            {n === 0 ? t("accounting.nonReinscrits.reglageJamais")
              : dateRetrait(n) ? t("accounting.nonReinscrits.reglageMoisDate", { n, date: dateRetrait(n) })
                : t("accounting.nonReinscrits.reglageMois", { n })}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
        {t("accounting.nonReinscrits.reglageAide")}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn disabled={!valide || enCours} onClick={valider}>{t("common.save")}</Btn>
      </div>
    </Modale>
  );
}
