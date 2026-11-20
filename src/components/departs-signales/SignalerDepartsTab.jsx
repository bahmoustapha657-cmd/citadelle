import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, estSorti } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { libelleStatutEleve } from "../../i18n/libelles";
import { aujourdhuiIso } from "../../depart-utils";
import {
  STATUTS_SIGNALABLES, elevesSignalementRefuse, elevesSignalesEnAttente, getSignalement,
} from "../../depart-signale";
import { Btn, Card, Input, Selec } from "../ui";
import { resumeSignalement, retirerSignalement, signalerDepart } from "./depart-signale-actions";

const VIDE = { classe: "", eleveId: "", statut: "Transféré", dateDepart: "", motifDepart: "", destinationDepart: "" }; // i18n-ignore

// Onglet « 📤 Départs » du module École : le chef de section (ou la
// Direction) signale à la comptabilité l'élève qui quitte l'école — c'est
// elle qui arrête ses mensualités en confirmant. En dessous, ce qui attend
// la comptabilité, et ce qu'elle a refusé (avec sa raison) jusqu'à lecture.
// `eleves` : les élèves de la section ; `modChamp` : écriture de leurs fiches.
export function SignalerDepartsTab({ eleves = [], classes = [], modChamp, userRole = "", annee = "" }) {
  const { t } = useTranslation();
  const { toast, logAction, envoyerPush, auteur } = useContext(SchoolContext);
  const [saisie, setSaisie] = useState(() => ({ ...VIDE, dateDepart: aujourdhuiIso() }));
  const [envoi, setEnvoi] = useState(false);
  const chg = (k) => (ev) => setSaisie((p) => ({ ...p, [k]: ev.target.value }));

  const enAttente = elevesSignalesEnAttente(eleves, annee);
  const refuses = elevesSignalementRefuse(eleves, annee);
  const dejaSignales = new Set(enAttente.map((e) => e._id));
  const nom = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim();
  const parNom = (a, b) => nom(a).localeCompare(nom(b), "fr");
  // Élèves encore inscrits de la classe choisie, sans ceux déjà signalés.
  const candidats = eleves
    .filter((e) => !estSorti(e) && !dejaSignales.has(e._id) && (!saisie.classe || e.classe === saisie.classe))
    .sort(parNom);
  const eleve = candidats.find((e) => e._id === saisie.eleveId) || null;
  const deps = { modChamp, logAction, toast, envoyerPush, auteur, role: userRole, annee };

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const ok = await signalerDepart(eleve, saisie, deps);
      if (ok) setSaisie((p) => ({ ...VIDE, classe: p.classe, dateDepart: aujourdhuiIso() }));
    } catch (err) {
      toast?.(t("departsSignales.saveError", { error: err.message }), "error");
    } finally {
      setEnvoi(false);
    }
  };
  const retirer = async (e) => {
    try { await retirerSignalement(e, deps); } catch (err) { toast?.(t("departsSignales.saveError", { error: err.message }), "error"); }
  };

  const ligne = (e, refus) => {
    const s = getSignalement(e, annee);
    return (
      <div key={e._id} data-testid={refus ? "depart-refuse" : "depart-en-attente"}
        style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", padding: "10px 12px", borderTop: "1px solid var(--lc-border-soft, #f1f5f9)" }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
          <strong>{nom(e)}</strong> <span style={{ color: "#64748b" }}>({e.classe || "—"})</span>
          <div style={{ color: "#334155", marginTop: 2 }}>{resumeSignalement(s)}</div>
          <div style={{ color: "#64748b", fontSize: 11.5, marginTop: 2 }}>
            {t("departsSignales.sentBy", { author: s.signalePar || "—", date: s.signaleLe || "—" })}
          </div>
          {refus && (
            <div style={{ color: "#991b1b", fontSize: 12, marginTop: 4, fontWeight: 600 }}>
              {t("departsSignales.refusedBy", { author: s.refusePar || "—", date: s.refuseLe || "—", reason: s.motifRefus })}
            </div>
          )}
        </div>
        <Btn sm v="ghost" onClick={() => retirer(e)}>{refus ? t("departsSignales.seen") : t("departsSignales.withdraw")}</Btn>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "16px 18px", overflow: "visible" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: C.blueDark }}>📤 {t("departsSignales.formTitle")}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#475569" }}>{t("departsSignales.intro")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Selec label={t("departsSignales.class")} aria-label={t("departsSignales.class")} value={saisie.classe}
            onChange={(ev) => setSaisie((p) => ({ ...p, classe: ev.target.value, eleveId: "" }))}>
            <option value="">{t("departsSignales.allClasses")}</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Selec>
          <Selec label={t("departsSignales.student")} aria-label={t("departsSignales.student")} value={saisie.eleveId} onChange={chg("eleveId")}>
            <option value="">{t("departsSignales.pickStudent")}</option>
            {candidats.map((e) => <option key={e._id} value={e._id}>{nom(e)}{saisie.classe ? "" : ` — ${e.classe || "—"}`}</option>)}
          </Selec>
          <Selec label={t("departsSignales.type")} aria-label={t("departsSignales.type")} value={saisie.statut} onChange={chg("statut")}>
            {STATUTS_SIGNALABLES.map((s) => <option key={s} value={s}>{libelleStatutEleve(s)}</option>)}
          </Selec>
          <Input label={t("enrolment.departureDate")} aria-label={t("enrolment.departureDate")} type="date"
            value={saisie.dateDepart} onChange={chg("dateDepart")} />
          {saisie.statut === "Transféré" && ( // i18n-ignore
            <Input label={t("enrolment.destinationSchool")} aria-label={t("enrolment.destinationSchool")}
              value={saisie.destinationDepart} onChange={chg("destinationDepart")} placeholder={t("enrolment.destinationSchoolPlaceholder")} />
          )}
          <Input label={t("enrolment.departureReason")} aria-label={t("enrolment.departureReason")}
            value={saisie.motifDepart} onChange={chg("motifDepart")} placeholder={t("departsSignales.reasonPlaceholder")} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Btn onClick={envoyer} disabled={envoi || !eleve}>{envoi ? "⏳" : "📨"} {t("departsSignales.send")}</Btn>
        </div>
      </Card>

      <Card style={{ overflow: "visible" }}>
        <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, fontWeight: 800, color: C.blueDark }}>
          ⏳ {t("departsSignales.pendingTitle", { count: enAttente.length })}
        </p>
        {enAttente.length === 0
          ? <p style={{ margin: 0, padding: "0 14px 14px", fontSize: 12.5, color: "#64748b" }}>{t("departsSignales.nonePending")}</p>
          : [...enAttente].sort(parNom).map((e) => ligne(e, false))}
      </Card>

      {refuses.length > 0 && (
        <Card style={{ overflow: "visible", border: "1px solid #fecaca" }}>
          <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, fontWeight: 800, color: "#991b1b" }}>
            ✋ {t("departsSignales.refusedTitle", { count: refuses.length })}
          </p>
          {[...refuses].sort(parNom).map((e) => ligne(e, true))}
        </Card>
      )}
    </div>
  );
}
