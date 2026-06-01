import { C, MONNAIES } from "../../../constants";

// Section "Informations générales" : nom, type, ville, pays, devise, monnaie.
export function InfosGeneralesSection({ form, setForm, chg, inp, lbl, sec }) {
  return (
    <div style={sec}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🏫 Informations générales</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbl}>Nom de l'école *</label>
          <input style={inp} value={form.nom} onChange={chg("nom")} placeholder="Ex. : La Citadelle" />
        </div>
        <div>
          <label style={lbl}>Type d'établissement</label>
          <input style={inp} value={form.type} onChange={chg("type")} placeholder="Ex. : Groupe Scolaire Privé" />
        </div>
        <div>
          <label style={lbl}>Ville</label>
          <input style={inp} value={form.ville} onChange={chg("ville")} placeholder="Ex. : Kindia" />
        </div>
        <div>
          <label style={lbl}>Pays</label>
          <input style={inp} value={form.pays} onChange={chg("pays")} placeholder="Ex. : Guinée" />
        </div>
      </div>
      <label style={lbl}>Devise / Slogan</label>
      <input style={inp} value={form.devise} onChange={chg("devise")} placeholder="Ex. : Travail – Rigueur – Réussite" />
      <div style={{ marginTop: 16 }}>
        <label style={lbl}>Monnaie utilisée pour les montants</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inp, maxWidth: 180 }} value={MONNAIES.includes((form.monnaie || "").toUpperCase()) ? form.monnaie.toUpperCase() : "__autre__"}
            onChange={e => {
              const v = e.target.value;
              if (v === "__autre__") setForm(p => ({ ...p, monnaie: "" }));
              else setForm(p => ({ ...p, monnaie: v }));
            }}>
            {MONNAIES.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="__autre__">Autre…</option>
          </select>
          {!MONNAIES.includes((form.monnaie || "").toUpperCase()) &&
            <input style={{ ...inp, maxWidth: 120 }} value={form.monnaie} onChange={chg("monnaie")} placeholder="Ex. CAD" maxLength={5} />}
          <span style={{ fontSize: 11, color: "#64748b" }}>Affichée après chaque montant (ex. « 125 000 {form.monnaie || "GNF"} »).</span>
        </div>
      </div>
    </div>
  );
}
