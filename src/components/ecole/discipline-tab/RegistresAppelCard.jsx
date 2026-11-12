import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { getSectionLabel } from "../../../constants";
import { useFirestore } from "../../../hooks/useFirestore";
import { getJoursOuvrables } from "../edt/edt-utils";
import { chefDeSection, imprimerRegistresAppel, titreChefSection, titreTitulaire } from "../../../reports/registre-appel";
import { ficheTitulaire } from "../edt/edt-titulaire";
import {
  cleMois, debutDeMois, formaterTaux, joursDeClasse, joursDeConge, libelleMois, moisDeLAnnee, moisPrecedent, registreMensuel,
} from "../../portail-enseignant/registre-mensuel";

// Registres d'appel de la section, arrêtés à la fin du mois : présences
// possibles, présences effectives et taux de fréquentation par classe, puis
// impression (une classe, ou toutes : une page par classe). L'impression est
// réservée aux chefs de section et à la Direction ; les enseignants n'en ont
// qu'un aperçu dans leur portail.
// Jours de classe : jours ouvrés de la section, sans les congés du
// calendrier scolaire ; le chef de section peut retirer un jour de plus
// (fermeture imprévue) d'un toucher, pour toutes les classes.
// Titre du chef de section retouché avant d'imprimer : gardé sur l'appareil,
// par école et par section (un chef de section imprime depuis le sien).
const cleTitre = (schoolInfo, section) => `registre-titre-chef:${schoolInfo?.code || schoolInfo?.nom || ""}:${section}`;
const cleNom = (schoolInfo, section) => `registre-nom-chef:${schoolInfo?.code || schoolInfo?.nom || ""}:${section}`;
const lireTitre = (cle) => {
  try { return localStorage.getItem(cle) || ""; } catch { return ""; }
};
const ecrireTitre = (cle, valeur) => {
  try {
    if (valeur) localStorage.setItem(cle, valeur);
    else localStorage.removeItem(cle);
  } catch { /* stockage indisponible : le titre vaut pour cette fois */ }
};

const selectStyle = {
  minHeight: 34, border: "1px solid #b0c4d8", borderRadius: 7, padding: "0 8px",
  fontSize: 12, fontWeight: 600, background: "#fff", fontFamily: "inherit",
};

export function RegistresAppelCard({
  eleves = [], absences = [], section = "college", peutImprimer = false, couleur = "#0A1628", ens = [], classesEcole = [],
}) {
  const { t, i18n } = useTranslation();
  const langue = i18n.resolvedLanguage || i18n.language || "fr";
  const { schoolInfo = {}, toast } = useContext(SchoolContext);
  const { items: evenements } = useFirestore("evenements");
  const annee = schoolInfo.anneeScolaire || "";
  const aujourdhui = new Date();
  const listeMois = moisDeLAnnee(annee, aujourdhui);
  // Les premiers jours d'un mois, c'est le mois écoulé qu'on arrête.
  const [moisChoisi, setMoisChoisi] = useState(
    debutDeMois(aujourdhui) ? moisPrecedent(aujourdhui) : cleMois(aujourdhui),
  );
  const mois = listeMois.includes(moisChoisi) ? moisChoisi : listeMois[listeMois.length - 1];
  const [exclusParMois, setExclusParMois] = useState({});
  const exclus = exclusParMois[mois] || [];
  // Ouverte d'office : le tableau par classe (et son bouton d'impression
  // par classe) se voit sans chercher.
  const [ouvert, setOuvert] = useState(true);
  const [classeChoisie, setClasseChoisie] = useState("");
  const titreParDefaut = titreChefSection(schoolInfo, section);
  const [titreSaisi, setTitreSaisi] = useState(() => lireTitre(cleTitre(schoolInfo, section)));
  const titreChef = titreSaisi.trim() || titreParDefaut;
  const chefParDefaut = chefDeSection(schoolInfo, section);
  const [nomSaisi, setNomSaisi] = useState(() => lireTitre(cleNom(schoolInfo, section)));
  const chef = { ...chefParDefaut, nom: nomSaisi.trim() || chefParDefaut.nom };

  const joursOuvrables = getJoursOuvrables(schoolInfo, section);
  const conges = joursDeConge(evenements, getSectionLabel(section));
  const classes = [...new Set(eleves.map((e) => e.classe).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
  const registres = classes.map((classe) => ({
    classe,
    registre: registreMensuel({
      eleves: eleves.filter((e) => e.classe === classe), incidents: absences, mois, joursOuvrables, conges, exclus,
    }),
  }));
  const section_ = registres.reduce((s, { registre: r }) => ({
    possibles: s.possibles + r.totaux.possibles, effectives: s.effectives + r.totaux.effectives,
  }), { possibles: 0, effectives: 0 });
  const classeImpression = classes.includes(classeChoisie) ? classeChoisie : (classes[0] || "");
  const registreClasse = registres.find((r) => r.classe === classeImpression);
  const tauxSection =section_.possibles > 0 ? Math.round((section_.effectives / section_.possibles) * 1000) / 10 : 0;
  // Tous les jours ouvrés du mois (congés compris) : on retire/rajoute d'un toucher.
  const joursOuvres = joursDeClasse(mois, joursOuvrables, aujourdhui);

  const imprimer = (liste) => {
    const fait = imprimerRegistresAppel(
      liste.map(({ classe, registre }) => {
        const tit = ficheTitulaire(classe, ens, classesEcole);
        return { classe, registre, annee, titreChef, chef, titulaire: titreTitulaire(section, tit.civilite), nomTitulaire: tit.nom };
      }),
      { schoolInfo },
    );
    if (!fait && toast) toast(t("teacher.register.popupBlocked"), "warning");
  };
  const basculerJour = (date) => setExclusParMois((cur) => {
    const liste = cur[mois] || [];
    return { ...cur, [mois]: liste.includes(date) ? liste.filter((d) => d !== date) : [...liste, date] };
  });

  if (classes.length === 0) return null;
  return (
    <div style={{ border: "1px solid #dbe4ee", borderRadius: 10, background: "#fff", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderBottom: ouvert ? "1px solid #eef2f7" : "none" }}>
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
          style={{ flex: "1 1 180px", textAlign: "start", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 800, color: couleur, padding: 0 }}>
          {ouvert ? "▾" : "▸"} 📒 {t("school.registers.title")}
        </button>
        <select aria-label={t("teacher.register.month")} value={mois} onChange={(e) => setMoisChoisi(e.target.value)} style={{ ...selectStyle, textTransform: "capitalize" }}>
          {listeMois.map((m) => <option key={m} value={m}>{libelleMois(m, langue)}</option>)}
        </select>
        <span style={{ fontSize: 12, fontWeight: 800, color: couleur }}>
          {t("school.registers.sectionRate", { rate: formaterTaux(tauxSection, langue) })}
        </span>
        {peutImprimer && (
          <button type="button" onClick={() => imprimer(registres)}
            style={{ minHeight: 34, padding: "0 12px", borderRadius: 7, border: `1px solid ${couleur}`, background: "#fff", color: couleur, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            🖨️ {t("school.registers.printAll", { count: classes.length })}
          </button>
        )}
      </div>

      {/* Impression d'UNE classe : le geste le plus courant du chef de section. */}
      {peutImprimer && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
            {t("teacher.register.class")}
            <select aria-label={t("teacher.register.class")} value={classeImpression} onChange={(e) => setClasseChoisie(e.target.value)} style={selectStyle}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {registreClasse && (
            <span style={{ fontSize: 12, color: "#475569" }}>
              {t("school.registers.classSummary", {
                possibles: registreClasse.registre.totaux.possibles.toLocaleString(langue),
                effectives: registreClasse.registre.totaux.effectives.toLocaleString(langue),
                rate: formaterTaux(registreClasse.registre.totaux.taux, langue),
              })}
            </span>
          )}
          <button type="button" disabled={!registreClasse} onClick={() => registreClasse && imprimer([registreClasse])}
            style={{ marginInlineStart: "auto", minHeight: 36, padding: "0 14px", borderRadius: 7, border: "none", background: couleur, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
            🖨️ {t("school.registers.printOne", { classe: classeImpression })}
          </button>
          <label style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 700, color: "#475569" }}>
            ✍️ {t("school.registers.headTitle")}
            <input type="text" value={titreSaisi} placeholder={titreParDefaut} maxLength={60}
              onChange={(e) => { setTitreSaisi(e.target.value); ecrireTitre(cleTitre(schoolInfo, section), e.target.value.trim()); }}
              style={{ ...selectStyle, flex: "1 1 180px", maxWidth: 280, fontWeight: 700 }} />
            <span style={{ flexBasis: "100%", fontSize: 11, fontWeight: 400, color: "#64748b" }}>{t("school.registers.headTitleHint")}</span>
          </label>
          <label style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 700, color: "#475569" }}>
            👤 {t("school.registers.headName")}
            <input type="text" value={nomSaisi} placeholder={chefParDefaut.nom} maxLength={80}
              onChange={(e) => { setNomSaisi(e.target.value); ecrireTitre(cleNom(schoolInfo, section), e.target.value.trim()); }}
              style={{ ...selectStyle, flex: "1 1 180px", maxWidth: 280, fontWeight: 700 }} />
            <span style={{ flexBasis: "100%", fontSize: 11, fontWeight: 400, color: "#64748b" }}>{t("school.registers.headNameHint")}</span>
          </label>
        </div>
      )}

      {ouvert && (
        <div style={{ padding: "10px 12px" }}>
          {!peutImprimer && <div style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", borderRadius: 7, padding: "6px 10px", marginBottom: 8 }}>{t("school.registers.readOnly")}</div>}

          <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 6 }}>{t("school.registers.daysHint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {joursOuvres.map(({ date, jour }) => {
              const conge = conges.has(date);
              const retire = exclus.includes(date);
              const actif = !conge && !retire;
              return (
                <button key={date} type="button" disabled={conge || !peutImprimer} onClick={() => basculerJour(date)}
                  title={conge ? t("school.registers.holiday") : retire ? t("school.registers.removed") : t("school.registers.classDay")}
                  aria-pressed={actif}
                  style={{
                    minWidth: 34, minHeight: 32, borderRadius: 6, fontSize: 12, fontWeight: 800,
                    cursor: conge || !peutImprimer ? "default" : "pointer",
                    border: `1.5px solid ${actif ? couleur : "#cbd5e1"}`,
                    background: conge ? "#dcfce7" : retire ? "#f1f5f9" : "#fff",
                    color: conge ? "#166534" : retire ? "#94a3b8" : couleur,
                    textDecoration: retire ? "line-through" : "none",
                  }}>
                  {jour}
                </button>
              );
            })}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "#64748b", fontSize: 11 }}>
                  <th style={{ textAlign: "start", padding: "6px 4px" }}>{t("teacher.register.class")}</th>
                  <th style={{ padding: "6px 4px" }}>{t("school.registers.students")}</th>
                  <th style={{ padding: "6px 4px" }}>{t("teacher.register.possible")}</th>
                  <th style={{ padding: "6px 4px" }}>{t("teacher.register.effective")}</th>
                  <th style={{ padding: "6px 4px" }}>{t("teacher.register.rate")}</th>
                  {peutImprimer && <th />}
                </tr>
              </thead>
              <tbody>
                {registres.map((item) => (
                  <tr key={item.classe} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 4px", fontWeight: 800 }}>{item.classe}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>{item.registre.lignes.length}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>{item.registre.totaux.possibles.toLocaleString(langue)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>{item.registre.totaux.effectives.toLocaleString(langue)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 900, color: couleur }}>{formaterTaux(item.registre.totaux.taux, langue)} %</td>
                    {peutImprimer && (
                      <td style={{ padding: "4px", textAlign: "end" }}>
                        <button type="button" onClick={() => imprimer([item])}
                          style={{ minHeight: 30, padding: "0 10px", borderRadius: 6, border: `1px solid ${couleur}`, background: "#fff", color: couleur, fontWeight: 800, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" }}>
                          🖨️ {t("school.registers.print")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
