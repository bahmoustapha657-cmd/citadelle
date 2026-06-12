import { C, TOUS_MOIS_LONGS, SYSTEMES_SCOLAIRES, calcMoisAnnee, getClassesForSection } from "../../../constants";
import { PERIODICITES, getPeriodesForSchool } from "../../../period-utils";
import { Btn } from "../../ui";

// Sections "Mois de début d'année" et "Périodicité scolaire" (primaire + secondaire),
// avec avertissement de migration des notes si la périodicité change.
export function AnneePeriodiciteSection({ form, chg, schoolInfo, setMigrationOuverte, inp, sec }) {
  const periodiciteChange =
    ((schoolInfo.periodicitePrimaire || schoolInfo.periodicite) && (schoolInfo.periodicitePrimaire || schoolInfo.periodicite) !== form.periodicitePrimaire)
    || ((schoolInfo.periodiciteSecondaire || schoolInfo.periodicite) && (schoolInfo.periodiciteSecondaire || schoolInfo.periodicite) !== form.periodiciteSecondaire);
  const systemeChoisi = form.systemeScolaire || "guineen";
  const apercuClasses = [
    getClassesForSection("primaire", systemeChoisi)[0],
    getClassesForSection("college", systemeChoisi)[0],
    getClassesForSection("lycee", systemeChoisi)[0],
  ].join(" · ");

  return (
    <>
      <div style={sec}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🏫 Système de classes</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Détermine les classes proposées dans les sélecteurs (élèves, tarifs, enseignants).
          Le suivi des sections et la promotion de fin d'année reconnaissent les deux nomenclatures.
        </p>
        <select style={{ ...inp, cursor: "pointer" }} value={systemeChoisi} onChange={chg("systemeScolaire")}>
          {SYSTEMES_SCOLAIRES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
          Exemples : <strong style={{ color: C.blue }}>{apercuClasses}</strong>… (divisions A à D, saisie libre possible)
        </p>
      </div>

      <div style={sec}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>📅 Mois de début de l'année</h3>
        <select style={{ ...inp, cursor: "pointer" }} value={form.moisDebut} onChange={chg("moisDebut")}>
          {TOUS_MOIS_LONGS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
          Actuellement : <strong style={{ color: C.blue }}>{calcMoisAnnee(form.moisDebut).join(" · ")}</strong>
        </p>
      </div>

      <div style={sec}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🗓️ Périodicité scolaire</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Le primaire et le secondaire peuvent suivre des rythmes différents. Convention typique en Guinée : <strong>Primaire trimestre</strong>, <strong>Secondaire semestre</strong>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.blueDark, marginBottom: 6 }}>Primaire</label>
            <select style={{ ...inp, cursor: "pointer" }} value={form.periodicitePrimaire || "trimestre"} onChange={chg("periodicitePrimaire")}>
              {PERIODICITES.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
              <strong style={{ color: C.blue }}>
                {getPeriodesForSchool({ periodicite: form.periodicitePrimaire, moisDebut: form.moisDebut }).join(" · ")}
              </strong>
            </p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.blueDark, marginBottom: 6 }}>Secondaire (collège + lycée)</label>
            <select style={{ ...inp, cursor: "pointer" }} value={form.periodiciteSecondaire || "trimestre"} onChange={chg("periodiciteSecondaire")}>
              {PERIODICITES.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
              <strong style={{ color: C.blue }}>
                {getPeriodesForSchool({ periodicite: form.periodiciteSecondaire, moisDebut: form.moisDebut }).join(" · ")}
              </strong>
            </p>
          </div>
        </div>

        {periodiciteChange ? (
          <p style={{ margin: "8px 0 0", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
            ⚠️ Changer la périodicité après que des notes ont été saisies peut rendre certaines invisibles dans les bulletins. Après enregistrement, utilisez « Migrer les notes existantes » ci-dessous.
          </p>
        ) : null}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Btn sm v="ghost" onClick={() => setMigrationOuverte(true)}>🔁 Migrer les notes existantes…</Btn>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            Détecte les notes saisies sous une ancienne périodicité et propose un mapping vers la périodicité actuelle.
          </span>
        </div>
      </div>
    </>
  );
}
