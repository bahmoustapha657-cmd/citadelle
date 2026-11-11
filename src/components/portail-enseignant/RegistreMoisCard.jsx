import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Btn, Card } from "../ui";
import { registresAppelHTML } from "../../reports/registre-appel";
import { ApercuRegistre } from "./ApercuRegistre";
import {
  cleMois, debutDeMois, formaterTaux, libelleMois, lignesAuSuivi, moisDeLAnnee, moisPrecedent, registreMensuel,
} from "./registre-mensuel";

// Statistique du mois du registre d'appel, côté enseignant : présences
// possibles et effectives, taux de fréquentation, élèves les plus absents, et
// un APERÇU de la feuille. L'impression officielle revient au chef de
// section (module École → Discipline), qui seul voit les congés du calendrier.
const selectStyle = {
  minHeight: 36, border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "0 8px",
  fontSize: 13, fontFamily: "inherit", background: "#fff",
};

export function RegistreMoisCard({ c1, mesClasses = [], eleves = [], incidents = [], joursOuvrables, annee = "", schoolInfo = {}, nomEns = "", matiere = "" }) {
  const { t, i18n } = useTranslation();
  const langue = i18n.resolvedLanguage || i18n.language || "fr";
  const aujourdhui = new Date();
  const listeMois = moisDeLAnnee(annee, aujourdhui);
  const [moisChoisi, setMois] = useState(cleMois(aujourdhui));
  const mois = listeMois.includes(moisChoisi) ? moisChoisi : listeMois[listeMois.length - 1];
  const [classeChoisie, setClasse] = useState("");
  const classe = mesClasses.includes(classeChoisie) ? classeChoisie : (mesClasses[0] || "");
  const [apercu, setApercu] = useState("");

  const registre = registreMensuel({ eleves: eleves.filter((e) => e.classe === classe), incidents, mois, joursOuvrables });
  const suivi = lignesAuSuivi(registre);
  const precedent = moisPrecedent(aujourdhui);
  const rappel = debutDeMois(aujourdhui) && listeMois.includes(precedent) && mois !== precedent;
  const ouvrirApercu = () => setApercu(registresAppelHTML(
    [{ registre, classe, annee, nomEns, matiere }], { schoolInfo, apercu: true },
  ));

  if (mesClasses.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: c1, flex: "1 1 160px" }}>📊 {t("teacher.register.monthStats")}</strong>
        {mesClasses.length > 1 && (
          <select aria-label={t("teacher.register.class")} value={classe} onChange={(e) => setClasse(e.target.value)} style={selectStyle}>
            {mesClasses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select aria-label={t("teacher.register.month")} value={mois} onChange={(e) => setMois(e.target.value)} style={{ ...selectStyle, textTransform: "capitalize" }}>
          {listeMois.map((m) => <option key={m} value={m}>{libelleMois(m, langue)}</option>)}
        </select>
        <Btn sm v="blue" onClick={ouvrirApercu} disabled={registre.lignes.length === 0}>👁️ {t("teacher.register.preview")}</Btn>
      </div>

      {rappel && (
        <div style={{ margin: "10px 18px 0", padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e3a8a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>{t("teacher.register.monthEnded", { month: libelleMois(precedent, langue) })}</span>
          <Btn sm v="ghost" onClick={() => setMois(precedent)}>{t("teacher.register.seeMonth", { month: libelleMois(precedent, langue) })}</Btn>
        </div>
      )}

      <div style={{ padding: "12px 18px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        <Chiffre libelle={t("teacher.register.possible")} valeur={registre.totaux.possibles.toLocaleString(langue)} />
        <Chiffre libelle={t("teacher.register.effective")} valeur={registre.totaux.effectives.toLocaleString(langue)} />
        <Chiffre libelle={t("teacher.register.rate")} valeur={`${formaterTaux(registre.totaux.taux, langue)} %`} couleur={c1} />
      </div>

      <div style={{ padding: "8px 18px 10px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge color="gray">{t("teacher.register.statDays", { count: registre.jours.length })}</Badge>
        <Badge color="red">{t("teacher.register.statAbsNJ", { count: registre.totaux.absNJ })}</Badge>
        <Badge color="blue">{t("teacher.register.statAbsJ", { count: registre.totaux.absJ })}</Badge>
        <Badge color="amber">{t("teacher.register.statLate", { count: registre.totaux.retards })}</Badge>
      </div>
      <div style={{ padding: "0 18px 10px", fontSize: 11.5, color: "#64748b" }}>{t("teacher.register.teacherHint")}</div>

      {suivi.length === 0 ? (
        <div style={{ padding: "4px 18px 16px", color: "#64748b", fontSize: 12 }}>{t("teacher.register.noEvent")}</div>
      ) : (
        <div style={{ padding: "0 18px 14px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 11 }}>
                <th style={{ textAlign: "start", padding: "6px 4px" }}>{t("teacher.register.colStudent")}</th>
                <th style={{ padding: "6px 4px" }}>{t("teacher.register.colAbsNJ")}</th>
                <th style={{ padding: "6px 4px" }}>{t("teacher.register.colAbsJ")}</th>
                <th style={{ padding: "6px 4px" }}>{t("teacher.register.colLate")}</th>
              </tr>
            </thead>
            <tbody>
              {suivi.map((l) => (
                <tr key={l.eleve._id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 4px", fontWeight: 700 }}>{l.eleve.nom} {l.eleve.prenom}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: l.absNJ ? "#b91c1c" : "#cbd5e1" }}>{l.absNJ}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: l.absJ ? "#1d4ed8" : "#cbd5e1" }}>{l.absJ}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: l.retards ? "#b45309" : "#cbd5e1" }}>{l.retards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {apercu && <ApercuRegistre html={apercu} fermer={() => setApercu("")} />}
    </Card>
  );
}

function Chiffre({ libelle, valeur, couleur = "#0f172a" }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "#f8fafc" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{libelle}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: couleur }}>{valeur}</div>
    </div>
  );
}
