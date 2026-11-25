import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { Btn, Modale } from "./ui";
import { choixParDefaut, cleOrpheline, rangementComplet } from "./migration-periodes/migration-periodes-utils";

// Fenêtre unique du rangement des notes (cf. use-rangement-notes.js) : où vont
// les notes d'une période que l'école n'utilise plus. Les rangements évidents
// s'affichent faits ; une période à cheval pose UNE question, à boutons.
export function RangementNotesModal({ rangement, enCours, confirmer, annuler }) {
  const { t } = useTranslation();
  const [choix, setChoix] = useState(() => choixParDefaut(rangement.propositions));
  const { mode, annee, propositions, changements, anneesFigees } = rangement;
  const enregistrement = mode === "enregistrement";
  const complet = rangementComplet(propositions, choix);
  const total = propositions.reduce((s, p) => s + p.count, 0);
  const periode = (p) => t(`rangementNotes.periodes.${p}`, { defaultValue: p });
  const groupe = (g) => t(`rangementNotes.groupes.${g}`);
  const groupesAffiches = [...new Set(propositions.map((p) => p.groupe))];

  return (
    <Modale titre={t(enregistrement ? "rangementNotes.titreEnregistrement" : "rangementNotes.titreVerification", { annee })} fermer={annuler}>
      {/* #root centre le texte de l'app : ici, des explications à lire. */}
      <div style={{ textAlign: "start" }}>
        {changements.length > 0 && (
          <ul style={{ margin: "0 0 12px", paddingInlineStart: 18, fontSize: 13, color: C.blueDark, fontWeight: 700 }}>
            {changements.map((c) => (
              <li key={c.groupe}>
                {t("rangementNotes.changement", {
                  groupe: groupe(c.groupe),
                  avant: t(`rangementNotes.periodicites.${c.avant}`),
                  apres: t(`rangementNotes.periodicites.${c.apres}`),
                })}
              </li>
            ))}
          </ul>
        )}

        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--lc-text)" }}>
          {t("rangementNotes.intro", { annee, nombre: total })}
        </p>

        {groupesAffiches.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            {groupesAffiches.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {groupe(g)}
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {propositions.filter((p) => p.groupe === g).map((p) => {
                const cle = cleOrpheline(p);
                const quantite = t("rangementNotes.quantite", { nombre: p.count });
                if (p.evidente) {
                  return (
                    <div key={cle} data-rangement={cle}
                      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 12px", border: "1px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4", fontSize: 13 }}>
                      <span>✅</span>
                      <strong style={{ color: C.blueDark }}>{periode(p.periode)}</strong>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{quantite}</span>
                      <span style={{ color: "#64748b" }}>{t("rangementNotes.fleche")}</span>
                      <strong style={{ color: "#065f46" }}>{periode(p.options[0])}</strong>
                    </div>
                  );
                }
                const reponse = choix[cle];
                return (
                  <div key={cle} data-rangement={cle}
                    style={{ padding: "10px 12px", border: `1.5px solid ${reponse ? "#bbf7d0" : "#fbbf24"}`, borderRadius: 8, background: reponse ? "#f0fdf4" : "#fffbeb" }}>
                    <div style={{ fontSize: 13, marginBottom: 8, color: "var(--lc-text)" }}>
                      {reponse ? "✅ " : "❓ "}
                      {t("rangementNotes.question", { periode: periode(p.periode), quantite })}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.options.map((option) => {
                        const retenue = reponse === option;
                        return (
                          <button key={option} type="button" disabled={enCours}
                            onClick={() => setChoix((c) => ({ ...c, [cle]: option }))}
                            style={{ padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
                              border: retenue ? `2px solid ${C.green}` : "2px solid #e2e8f0",
                              background: retenue ? "#ecfdf5" : "#fff", color: retenue ? "#065f46" : "#334155" }}>
                            {retenue ? "✅ " : ""}{periode(option)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {enregistrement && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
            {anneesFigees.length
              ? t("rangementNotes.anneesFigees", { annees: anneesFigees.join(", ") })
              : t("rangementNotes.anneesIntactes")}
          </p>
        )}

        {!complet && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#92400e", fontWeight: 700 }}>
            {t("rangementNotes.repondre")}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <Btn v="ghost" onClick={annuler} disabled={enCours}>
            {t(enregistrement ? "rangementNotes.annulerEnregistrement" : "rangementNotes.annuler")}
          </Btn>
          <Btn v="success" onClick={() => confirmer(choix)} disabled={enCours || !complet}>
            {enCours
              ? t("rangementNotes.enCours")
              : t(enregistrement ? "rangementNotes.confirmerEnregistrement" : "rangementNotes.confirmerVerification")}
          </Btn>
        </div>
      </div>
    </Modale>
  );
}
