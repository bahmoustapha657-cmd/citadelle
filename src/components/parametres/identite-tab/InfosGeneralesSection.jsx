import { useTranslation } from "react-i18next";
import { C, MONNAIES } from "../../../constants";
import { estEspaceEnseignant } from "../../../espace-enseignant";
import { typeApresChangementStatut } from "../../../ecole-publique";

// Section "Informations générales" : nom, type, statut public/privé, ville,
// pays, devise, monnaie.
export function InfosGeneralesSection({ form, setForm, chg, schoolInfo = {}, inp, lbl, sec }) {
  const { t } = useTranslation();
  // Statut public/privé (src/ecole-publique.js) : sans objet dans l'espace
  // d'un enseignant seul, qui n'a déjà pas de comptabilité.
  const avecStatut = !estEspaceEnseignant(schoolInfo);
  const changerStatut = (e) => {
    const statut = e.target.value;
    setForm((p) => ({ ...p, statutEtablissement: statut, type: typeApresChangementStatut(p.type, statut) }));
  };
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
        {avecStatut && <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl} htmlFor="statut-etablissement">{t("publicSchool.statusLabel")}</label>
          <select id="statut-etablissement" style={{ ...inp, maxWidth: 260, cursor: "pointer" }}
            value={form.statutEtablissement || "prive"} onChange={changerStatut}>
            <option value="prive">{t("publicSchool.statusPrivate")}</option>
            <option value="public">{t("publicSchool.statusPublic")}</option>
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>{t("publicSchool.statusHint")}</p>
        </div>}
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
