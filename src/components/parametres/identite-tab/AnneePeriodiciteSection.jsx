import { C, TOUS_MOIS_LONGS, SYSTEMES_SCOLAIRES, SECTIONS_ECOLE, JOURS_SEMAINE, calcMoisAnnee, getClassesForSection, getSectionLabel } from "../../../constants";
import { PERIODICITES, getPeriodesForSchool } from "../../../period-utils";
import { Btn } from "../../ui";

// Sections "Mois de début d'année" et "Périodicité scolaire" (primaire + secondaire),
// avec avertissement de migration des notes si la périodicité change.
export function AnneePeriodiciteSection({ form, setForm, chg, schoolInfo, setMigrationOuverte, inp, sec }) {
  const sectionsChoisies = Array.isArray(form.sectionsActives) && form.sectionsActives.length
    ? form.sectionsActives : [...SECTIONS_ECOLE];
  const basculerSection = (section) => {
    const suivantes = sectionsChoisies.includes(section)
      ? sectionsChoisies.filter((s) => s !== section)
      : [...sectionsChoisies, section];
    if (!suivantes.length) return; // au moins une section ouverte
    setForm((p) => ({ ...p, sectionsActives: SECTIONS_ECOLE.filter((s) => suivantes.includes(s)) }));
  };
  // Jours ouvrables, réglés par section (le primaire s'arrête souvent le
  // vendredi quand le secondaire travaille le samedi). Champ vide = semaine
  // complète, et on retombe TOUJOURS sur l'ordre canonique de la semaine.
  const joursDe = (champ) => {
    const brut = form[champ];
    const retenus = Array.isArray(brut) ? JOURS_SEMAINE.filter((j) => brut.includes(j)) : [];
    return retenus.length ? retenus : [...JOURS_SEMAINE];
  };
  const basculerJour = (champ, jour) => {
    const actuels = joursDe(champ);
    const suivants = actuels.includes(jour)
      ? actuels.filter((j) => j !== jour)
      : [...actuels, jour];
    if (!suivants.length) return; // au moins un jour de classe
    setForm((p) => ({ ...p, [champ]: JOURS_SEMAINE.filter((j) => suivants.includes(j)) }));
  };
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
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🏛️ Sections de l'établissement</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Cochez les sections réellement ouvertes : une école sans lycée ne verra plus l'onglet Lycée
          ni ses classes proposées. Au moins une section reste ouverte.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SECTIONS_ECOLE.map((section) => {
            const active = sectionsChoisies.includes(section);
            return (
              <button key={section} type="button" onClick={() => basculerSection(section)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9,
                  border: active ? `2px solid ${C.green}` : "2px solid #e2e8f0",
                  background: active ? "#ecfdf5" : "#f8fafc", cursor: "pointer",
                  fontSize: 13, fontWeight: 700, color: active ? "#065f46" : "#94a3b8" }}>
                {active ? "✅" : "☐"} {getSectionLabel(section)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={sec}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>🗓️ Jours ouvrables</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
          Jours de classe, réglables séparément pour le primaire et le secondaire : ils déterminent
          les colonnes de l'emploi du temps, à l'écran comme à l'impression. Le préscolaire suit le
          primaire. Au moins un jour reste ouvert de chaque côté.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { champ: "joursOuvrablesPrimaire", label: "Primaire (+ préscolaire)" },
            { champ: "joursOuvrablesSecondaire", label: "Secondaire (collège + lycée)" },
          ].map(({ champ, label }) => {
            const joursChoisis = joursDe(champ);
            return (
              <div key={champ}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.blueDark, marginBottom: 6 }}>{label}</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {JOURS_SEMAINE.map((jour) => {
                    const ouvert = joursChoisis.includes(jour);
                    return (
                      <button key={jour} type="button" onClick={() => basculerJour(champ, jour)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9,
                          border: ouvert ? `2px solid ${C.green}` : "2px solid #e2e8f0",
                          background: ouvert ? "#ecfdf5" : "#f8fafc", cursor: "pointer",
                          fontSize: 13, fontWeight: 700, color: ouvert ? "#065f46" : "#94a3b8" }}>
                        {ouvert ? "✅" : "☐"} {jour}
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>
                  Semaine actuelle : <strong style={{ color: C.blue }}>{joursChoisis.join(" · ")}</strong>
                </p>
              </div>
            );
          })}
        </div>
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
