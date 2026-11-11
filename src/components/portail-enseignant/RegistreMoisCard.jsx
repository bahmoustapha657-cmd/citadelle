import { useContext, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useTranslation } from "react-i18next";
import { Badge, Btn, Card } from "../ui";
import { imprimerRegistreAppel } from "../../reports/registre-appel";
import {
  cleMois, debutDeMois, libelleMois, lignesAuSuivi, moisDeLAnnee, moisPrecedent, registreMensuel,
} from "./registre-mensuel";

// Statistique du mois du registre d'appel : bilan à l'écran (élèves les plus
// absents d'abord) et feuille imprimable de toute la classe. Les premiers
// jours d'un mois, un rappel propose d'imprimer celle du mois écoulé.
const selectStyle = {
  minHeight: 36, border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "0 8px",
  fontSize: 13, fontFamily: "inherit", background: "#fff",
};

export function RegistreMoisCard({ c1, mesClasses = [], eleves = [], incidents = [], joursOuvrables, annee = "", schoolInfo = {}, nomEns = "", matiere = "" }) {
  const { t, i18n } = useTranslation();
  const { toast } = useContext(SchoolContext);
  const langue = i18n.resolvedLanguage || i18n.language || "fr";
  const aujourdhui = new Date();
  const listeMois = moisDeLAnnee(annee, aujourdhui);
  const [moisChoisi, setMois] = useState(cleMois(aujourdhui));
  const mois = listeMois.includes(moisChoisi) ? moisChoisi : listeMois[listeMois.length - 1];
  const [classeChoisie, setClasse] = useState("");
  const classe = mesClasses.includes(classeChoisie) ? classeChoisie : (mesClasses[0] || "");

  const registre = registreMensuel({ eleves: eleves.filter((e) => e.classe === classe), incidents, mois, joursOuvrables });
  const suivi = lignesAuSuivi(registre);
  const precedent = moisPrecedent(aujourdhui);
  const rappel = debutDeMois(aujourdhui) && listeMois.includes(precedent) && mois !== precedent;

  const imprimer = () => {
    const ouvert = imprimerRegistreAppel({ registre, classe, schoolInfo, annee, nomEns, matiere });
    if (!ouvert && toast) toast(t("teacher.register.popupBlocked"), "warning");
  };

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
        <Btn sm v="blue" onClick={imprimer} disabled={registre.lignes.length === 0}>🖨️ {t("teacher.register.print")}</Btn>
      </div>

      {rappel && (
        <div style={{ margin: "10px 18px 0", padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e3a8a", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>{t("teacher.register.monthEnded", { month: libelleMois(precedent, langue) })}</span>
          <Btn sm v="ghost" onClick={() => setMois(precedent)}>{t("teacher.register.seeMonth", { month: libelleMois(precedent, langue) })}</Btn>
        </div>
      )}

      <div style={{ padding: "10px 18px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge color="gray">{t("teacher.register.statDays", { count: registre.jours.length })}</Badge>
        <Badge color="red">{t("teacher.register.statAbsNJ", { count: registre.totaux.absNJ })}</Badge>
        <Badge color="blue">{t("teacher.register.statAbsJ", { count: registre.totaux.absJ })}</Badge>
        <Badge color="amber">{t("teacher.register.statLate", { count: registre.totaux.retards })}</Badge>
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
          {t("teacher.register.statConcerned", { count: registre.totaux.elevesConcernes, total: registre.lignes.length })}
        </span>
      </div>

      {suivi.length === 0 ? (
        <div style={{ padding: "4px 18px 16px", color: "#64748b", fontSize: 12 }}>{t("teacher.register.noEvent")}</div>
      ) : (
        <div style={{ padding: "0 18px 14px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 11, textAlign: "start" }}>
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
    </Card>
  );
}
