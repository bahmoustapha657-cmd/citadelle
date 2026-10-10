import React from "react";
import { Btn, Input, Modale, Selec, Textarea } from "../../ui";
import { agentsPourBon } from "../salaires/bon-agents";
import { STATUTS, TYPES_A_JUSTIFIER, TYPES_PRESENCE } from "./presences-utils";

// Saisie / modification d'un fait (absence, retard, permission…).
// `form` : { date, section, agentNom, type, duree, statut, motif }.
export function PresenceModale({ form, setForm, fermer, enregistrer, sections, listes, nouveau }) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const agents = agentsPourBon(form.section, listes, form.agentNom);
  const aJustifier = TYPES_A_JUSTIFIER.has(form.type);
  const valide = form.date && form.section && form.agentNom && form.type;
  return (
    <Modale titre={nouveau ? "Saisir une absence / un retard" : "Modifier"} fermer={fermer}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Date" type="date" value={form.date || ""} onChange={chg("date")} />
        <Selec label="Section de paie" value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value, agentNom: "" }))}>
          {sections.map((s) => <option key={s}>{s}</option>)}
        </Selec>
        <div style={{ gridColumn: "1/-1" }}>
          <Selec label="Agent" value={form.agentNom || ""} onChange={chg("agentNom")}>
            <option value="">— Sélectionner —</option>
            {agents.map((n) => <option key={n} value={n}>{n}</option>)}
          </Selec>
        </div>
        <Selec label="Type" value={form.type} onChange={chg("type")}>
          {TYPES_PRESENCE.map((t) => <option key={t.id} value={t.id}>{t.icone} {t.label}</option>)}
        </Selec>
        {form.type === "absence"
          ? <Selec label="Durée" value={form.duree || "journee"} onChange={chg("duree")}>
            <option value="journee">Journée entière</option>
            <option value="demi">Demi-journée</option>
          </Selec>
          : <div />}
        {aJustifier && <div style={{ gridColumn: "1/-1" }}>
          <Selec label="Décision" value={form.statut || "en_attente"} onChange={chg("statut")}>
            {Object.entries(STATUTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </Selec>
        </div>}
        <div style={{ gridColumn: "1/-1" }}>
          <Textarea label="Motif / observation" value={form.motif || ""} onChange={chg("motif")} placeholder="Ex : maladie (certificat fourni), sans nouvelle…" />
        </div>
      </div>
      {aJustifier && <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
        Seules les absences et retards <strong>injustifiés</strong> sont retenus sur le salaire. « En attente » : rien n'est retenu tant que la Direction ou la comptabilité n'a pas tranché.
      </div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={!valide} onClick={() => valide && enregistrer()}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
