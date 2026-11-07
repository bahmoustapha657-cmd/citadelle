import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Btn, Input, Modale, Selec, Textarea } from "../../ui";
import { libelleSectionPaie } from "../../../i18n/libelles";
import { agentsPourBon } from "../salaires/bon-agents";
import { STATUTS, TYPES_A_JUSTIFIER, TYPES_PRESENCE } from "./presences-utils";

// Saisie / modification d'un fait (absence, retard, permission…).
// `form` : { date, section, agentNom, type, duree, statut, motif }.
export function PresenceModale({ form, setForm, fermer, enregistrer, sections, listes, nouveau }) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const agents = agentsPourBon(form.section, listes, form.agentNom);
  const aJustifier = TYPES_A_JUSTIFIER.has(form.type);
  const valide = form.date && form.section && form.agentNom && form.type;
  return (
    <Modale titre={nouveau ? t("accounting.att.modal.newTitle") : t("accounting.editTitle")} fermer={fermer}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label={t("common.date")} type="date" value={form.date || ""} onChange={chg("date")} />
        <Selec label={t("accounting.att.modal.paySection")} value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value, agentNom: "" }))}>
          {sections.map((s) => <option key={s} value={s}>{libelleSectionPaie(s)}</option>)}
        </Selec>
        <div style={{ gridColumn: "1/-1" }}>
          <Selec label={t("accounting.att.cols.agent")} value={form.agentNom || ""} onChange={chg("agentNom")}>
            <option value="">{t("enrolment.select")}</option>
            {agents.map((n) => <option key={n} value={n}>{n}</option>)}
          </Selec>
        </div>
        <Selec label={t("accounting.att.cols.type")} value={form.type} onChange={chg("type")}>
          {TYPES_PRESENCE.map((ty) => <option key={ty.id} value={ty.id}>{ty.icone} {ty.label}</option>)}
        </Selec>
        {form.type === "absence"
          ? <Selec label={t("accounting.att.modal.duration")} value={form.duree || "journee"} onChange={chg("duree")}>
            <option value="journee">{t("accounting.att.modal.fullDay")}</option>
            <option value="demi">{t("accounting.att.modal.halfDay")}</option>
          </Selec>
          : <div />}
        {aJustifier && <div style={{ gridColumn: "1/-1" }}>
          <Selec label={t("accounting.att.cols.decision")} value={form.statut || "en_attente"} onChange={chg("statut")}>
            {Object.entries(STATUTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </Selec>
        </div>}
        <div style={{ gridColumn: "1/-1" }}>
          <Textarea label={t("accounting.att.modal.reason")} value={form.motif || ""} onChange={chg("motif")} placeholder={t("accounting.att.modal.reasonPh")} />
        </div>
      </div>
      {aJustifier && <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
        <Trans i18nKey="accounting.att.modal.ruleNote" components={{ b: <strong /> }} />
      </div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn disabled={!valide} onClick={() => valide && enregistrer()}>{t("common.save")}</Btn>
      </div>
    </Modale>
  );
}
