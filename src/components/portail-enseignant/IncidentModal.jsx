import { Trans, useTranslation } from "react-i18next";
import { Btn, Input, Modale, Selec } from "../ui";
import { TYPES_INCIDENT } from "./incidents-actions";
import { nomAppel, nomOfficiel } from "../../identite-enfant";
import { PhotoEleve } from "../identite-enfant/PhotoEleve";

// `eleve` : la fiche de l'enfant signalé, pour vérifier d'un coup d'œil
// (photo, surnom) qu'on signale le bon — absente pour un élève parti.
export function IncidentModal({ c1, mode, formIncident, setFormIncident, enregistrement, enregistrerIncident, fermer, eleve = null }) {
  const { t } = useTranslation();
  return (
    <Modale titre={mode === "edit" ? t("teacher.incident.editTitle") : t("teacher.incident.newTitle", { name: formIncident.eleveNom || "" })} fermer={fermer}>
      {eleve && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <PhotoEleve eleve={eleve} largeur={56}/>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: c1 }}>{nomAppel(eleve)}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{nomOfficiel(eleve)} · {eleve.classe}</div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
        <Trans i18nKey="teacher.incident.visibility" components={{ b: <strong /> }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Selec label={t("teacher.incident.type")} value={formIncident.type || "Absence"} onChange={(e) => setFormIncident((p) => ({ ...p, type: e.target.value }))}>
          {Object.entries(TYPES_INCIDENT).map(([valeur, cle]) => <option key={valeur} value={valeur}>{t(`teacher.incident.types.${cle}`)}</option>)}
        </Selec>
        <Input label={t("teacher.incident.date")} type="date" value={formIncident.date || ""} onChange={(e) => setFormIncident((p) => ({ ...p, date: e.target.value }))} />
        <Selec label={t("teacher.incident.justified")} value={formIncident.justifie || "Non"} onChange={(e) => setFormIncident((p) => ({ ...p, justifie: e.target.value }))}>
          <option value="Non">{t("common.no")}</option>
          <option value="Oui">{t("common.yes")}</option>
        </Selec>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 11, color: "#6b7280" }}>
          {t("teacher.incident.classLabel")} <strong style={{ marginInlineStart: 4 }}>{formIncident.classe || "—"}</strong>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c1, marginBottom: 4 }}>{t("teacher.incident.reason")}</label>
      <textarea
        rows={3}
        value={formIncident.motif || ""}
        onChange={(e) => setFormIncident((p) => ({ ...p, motif: e.target.value }))}
        placeholder={t("teacher.incident.reasonPlaceholder")}
        maxLength={500}
        style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
      />
      <div style={{ fontSize: 11, color: "#6b7280", textAlign: "end", marginTop: 2 }}>{(formIncident.motif || "").length} / 500</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.cancel")}</Btn>
        <Btn v="amber" onClick={enregistrerIncident} disabled={enregistrement}>{enregistrement ? t("teacher.incident.saving") : `✅ ${t("teacher.incident.save")}`}</Btn>
      </div>
    </Modale>
  );
}
