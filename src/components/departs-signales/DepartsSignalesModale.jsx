import { useState } from "react";
import { useTranslation } from "react-i18next";
import { libelleSection } from "../../i18n/libelles";
import { elevesSignalesEnAttente, getSignalement } from "../../depart-signale";
import { Btn, Modale, Textarea } from "../ui";
import { confirmerDepartSignale, refuserDepartSignale, resumeSignalement } from "./depart-signale-actions";

// Fenêtre « 📤 Départs signalés » de Comptabilité → Élèves : les départs que
// les chefs de section et la Direction ont signalés, toutes sections
// confondues. La comptable confirme (la fiche devient un départ, ses
// mensualités s'arrêtent à la date de départ) ou refuse en disant pourquoi.
// `paquet` : celui des dispenses (use-comptabilite) — élèves et écriture de
// chaque section ouverte, année, auteur et notifications.
export function DepartsSignalesModale({ paquet, fermer }) {
  const { t } = useTranslation();
  const { elevesParSection = {}, modParSection = {}, sections = [], annee = "", deps = {} } = paquet || {};
  // Refus en cours de saisie : { id, raison } ; null = aucun.
  const [refus, setRefus] = useState(null);
  const [enCours, setEnCours] = useState("");

  const lignes = sections.flatMap((section) => elevesSignalesEnAttente(elevesParSection[section] || [], annee)
    .map((eleve) => ({ section, eleve, signalement: getSignalement(eleve, annee) })));
  const nom = (e) => `${e.nom || ""} ${e.prenom || ""}`.trim();

  const agir = async (ligne, action) => {
    const modChamp = modParSection[ligne.section];
    if (!modChamp) return;
    setEnCours(ligne.eleve._id);
    try {
      const ok = await action({ ...deps, modChamp, annee });
      if (ok) setRefus(null);
    } catch (err) {
      deps.toast?.(t("departsSignales.saveError", { error: err.message }), "error");
    } finally {
      setEnCours("");
    }
  };

  return (
    <Modale large titre={`📤 ${t("departsSignales.inboxTitle")}`} fermer={fermer}>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#475569" }}>{t("departsSignales.inboxIntro")}</p>
      {lignes.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{t("departsSignales.nonePending")}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lignes.map((l) => {
          const { eleve, signalement: s } = l;
          const occupe = enCours === eleve._id;
          const enRefus = refus?.id === eleve._id;
          return (
            <div key={eleve._id} data-testid="depart-signale"
              style={{ border: "1px solid var(--lc-border, #e2e8f0)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{nom(eleve)}</strong>{" "}
                  <span style={{ color: "#64748b" }}>({libelleSection(l.section)} · {eleve.classe || "—"}{eleve.matricule ? ` · ${eleve.matricule}` : ""})</span>
                  <div style={{ color: "#334155", marginTop: 2, fontWeight: 600 }}>{resumeSignalement(s)}</div>
                  <div style={{ color: "#64748b", fontSize: 11.5, marginTop: 2 }}>
                    {t("departsSignales.sentBy", { author: s.signalePar || "—", date: s.signaleLe || "—" })}
                  </div>
                </div>
                {!enRefus && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn sm v="success" disabled={occupe}
                      onClick={() => agir(l, (d) => confirmerDepartSignale(eleve, d))}>
                      ✓ {t("departsSignales.confirm")}
                    </Btn>
                    <Btn sm v="ghost" disabled={occupe} onClick={() => setRefus({ id: eleve._id, raison: "" })}>
                      {t("departsSignales.refuse")}
                    </Btn>
                  </div>
                )}
              </div>
              {enRefus && (
                <div style={{ marginTop: 10 }}>
                  <Textarea label={t("departsSignales.refuseReason")} aria-label={t("departsSignales.refuseReason")}
                    value={refus.raison} onChange={(ev) => setRefus({ id: eleve._id, raison: ev.target.value })} />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                    <Btn sm v="ghost" disabled={occupe} onClick={() => setRefus(null)}>{t("common.cancel")}</Btn>
                    <Btn sm v="danger" disabled={occupe || !refus.raison.trim()}
                      onClick={() => agir(l, (d) => refuserDepartSignale(eleve, refus.raison, d))}>
                      {t("departsSignales.refuseSend")}
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>{t("common.close")}</Btn>
      </div>
    </Modale>
  );
}
