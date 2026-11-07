import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { C } from "../../../constants";
import { Btn, Input, Modale } from "../../ui";
import { faitExistant } from "./presences-utils";
import { libelleSectionPaie } from "../../../i18n/libelles";

const CHOIX = [
  { id: "present", cle: "present", couleur: C.greenDk, fond: "#dcfce7" },
  { id: "absence", cle: "absent", couleur: "#b91c1c", fond: "#fee2e2" },
  { id: "retard", cle: "late", couleur: "#b45309", fond: "#fef3c7" },
];

// Feuille de présence d'une journée : tout le personnel, présent par défaut ;
// on ne coche que les absents et les retards. Chaque absent / retard devient
// un fait « en attente » de décision ; refaire la feuille ne crée pas de
// doublon (un fait déjà saisi pour l'agent, la date et le type est gardé).
export function FeuilleDuJour({ agents, presences, dateInitiale, fermer, enregistrer }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(dateInitiale);
  const [etat, setEtat] = useState({});
  const [enCours, setEnCours] = useState(false);
  const cle = (a) => `${a.section}|${a.nom}`;
  const deja = (a, type) => Boolean(faitExistant(presences, { nom: a.nom, section: a.section, date, type }));
  const choixDe = (a) => etat[cle(a)] || (deja(a, "absence") ? "absence" : deja(a, "retard") ? "retard" : "present");
  const aCreer = agents.filter((a) => choixDe(a) !== "present" && !deja(a, choixDe(a)));
  const sections = [...new Set(agents.map((a) => a.section))];

  const valider = async () => {
    setEnCours(true);
    try { await enregistrer(date, aCreer.map((a) => ({ ...a, type: choixDe(a) }))); } finally { setEnCours(false); }
  };

  return (
    <Modale titre={t("accounting.att.sheet.title")} fermer={fermer} large>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ width: 180 }}><Input label={t("common.date")} type="date" value={date} onChange={(e) => { setDate(e.target.value); setEtat({}); }} /></div>
        <div style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
          <Trans i18nKey="accounting.att.sheet.defaultPresent" components={{ b: <strong /> }} />
        </div>
      </div>
      {agents.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>{t("accounting.att.sheet.noAgent")}</div>}
      <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {sections.map((section) => (
          <div key={section} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: ".05em", margin: "6px 0" }}>{libelleSectionPaie(section)}</div>
            {agents.filter((a) => a.section === section).map((a) => (
              <div key={cle(a)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderBottom: "1px solid var(--lc-border-soft)", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600 }}>{a.nom}</span>
                {CHOIX.map((ch) => {
                  const actif = choixDe(a) === ch.id;
                  const verrou = ch.id !== "present" && deja(a, ch.id);
                  return (
                    <button key={ch.id} type="button" disabled={verrou}
                      title={verrou ? t("accounting.att.sheet.alreadyEntered") : ""}
                      onClick={() => setEtat((p) => ({ ...p, [cle(a)]: ch.id }))}
                      style={{
                        border: `1.5px solid ${actif ? ch.couleur : "var(--lc-border)"}`, background: actif ? ch.fond : "transparent",
                        color: actif ? ch.couleur : "#64748b", borderRadius: 16, padding: "3px 11px", fontSize: 12, fontWeight: 700,
                        cursor: verrou ? "default" : "pointer",
                      }}>{t(`accounting.att.sheet.${ch.cle}`)}{verrou ? " ✓" : ""}</button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{t("accounting.att.sheet.toSave", { count: aCreer.length })}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={fermer}>{t("common.close")}</Btn>
          <Btn disabled={!date || aCreer.length === 0 || enCours} onClick={valider}>{enCours ? t("accounting.collect.saving") : t("accounting.att.sheet.save")}</Btn>
        </div>
      </div>
    </Modale>
  );
}
