import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../../contexts/SchoolContext";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement } from "../ui";
import { libelleSection } from "../../i18n/libelles";
import { changerEspace, mesClasses } from "../../backend/espaces-supabase";
import { retenirDestination } from "../app/destination-espace";
import { grouperParEtablissement, moduleDeSection, totauxMesClasses } from "./mes-classes";
import { AjoutEtablissementModale } from "./AjoutEtablissementModale";
import { DemandeRattachementModale } from "../rattachement/DemandeRattachementModale";
import { annulerRattachement } from "../../backend/rattachement-supabase";

// Demande de rattachement de l'établissement ouvert à son école (étape 3) :
// le bouton pour la faire, ou son état et l'annulation.
function EtatRattachement({ groupe, t, onDemander, onAnnuler, occupe }) {
  const r = groupe.rattachement;
  if (r?.statut === "en_attente") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Badge color="amber">⏳ {t("rattachement.pending", { ecole: r.ecole })}</Badge>
        {groupe.actuel && (
          <Btn sm v="ghost" disabled={occupe} onClick={onAnnuler}>{t("rattachement.cancel")}</Btn>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
      {r?.statut === "refusee" && <Badge color="red">{t("rattachement.refused", { ecole: r.ecole })}</Badge>}
      {groupe.actuel && (
        <Btn sm v="ghost" disabled={occupe} onClick={onDemander}>🏫 {t("rattachement.requestButton")}</Btn>
      )}
    </div>
  );
}

// « Toutes mes classes » — espace d'un enseignant indépendant (étape 2) :
// les classes de TOUS ses établissements, un par carte. Une classe de
// l'établissement ouvert s'ouvre tout de suite ; celle d'un autre
// établissement fait d'abord changer d'espace (sans mot de passe), puis
// l'app rouvre sur son module (destination-espace.js).
export function MesClasses({ setPage }) {
  const { t } = useTranslation();
  const { toast } = useContext(SchoolContext);
  const [etat, setEtat] = useState({ chargement: true, erreur: "", groupes: [] });
  const [ajout, setAjout] = useState(false);
  const [demande, setDemande] = useState(null);
  const [ouverture, setOuverture] = useState(null);
  const [annulation, setAnnulation] = useState(false);

  const lire = useCallback(() => mesClasses()
    .then((lignes) => setEtat({ chargement: false, erreur: "", groupes: grouperParEtablissement(lignes) }))
    .catch((err) => setEtat({ chargement: false, erreur: err?.message || String(err), groupes: [] })), []);
  useEffect(() => { lire(); }, [lire]);
  const recharger = () => {
    setEtat((e) => ({ ...e, chargement: true, erreur: "" }));
    lire();
  };

  // `page` : module à ouvrir (null = celui par défaut de l'établissement).
  const ouvrir = async (groupe, page, cle) => {
    if (groupe.actuel) { if (page) setPage(page); return; }
    setOuverture(cle);
    try {
      await changerEspace(groupe.compteId, groupe.code);
      if (page) retenirDestination(page);
      // Rechargement : l'app repart sur l'autre établissement (données,
      // synchro hors ligne), comme après une connexion.
      window.location.reload();
    } catch (err) {
      toast(err?.message || t("shell.spaces.error"), "error");
      setOuverture(null);
    }
  };

  const annuler = async () => {
    if (!window.confirm(t("rattachement.cancelConfirm"))) return;
    setAnnulation(true);
    try {
      await annulerRattachement();
      toast(t("rattachement.cancelled"), "success");
      recharger();
    } catch (err) {
      toast(err?.message || t("rattachement.errCancel"), "error");
    } finally {
      setAnnulation(false);
    }
  };

  const tot = totauxMesClasses(etat.groupes);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>📚 {t("shell.myClasses.menu")}</h2>
          {!etat.chargement && !etat.erreur && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--lc-text-muted, #64748b)", fontWeight: 600 }}>
              {t("shell.myClasses.summary", tot)}
            </p>
          )}
        </div>
        <Btn onClick={() => setAjout(true)} disabled={!!ouverture}>➕ {t("shell.myClasses.add")}</Btn>
      </div>

      {etat.chargement ? <Chargement /> : etat.erreur ? (
        <Card style={{ padding: 16 }}>
          <p style={{ margin: "0 0 10px", color: "#b91c1c", fontSize: 13 }}>
            {t("shell.myClasses.loadError", { error: etat.erreur })}
          </p>
          <Btn sm v="ghost" onClick={recharger}>{t("shell.myClasses.retry")}</Btn>
        </Card>
      ) : (
        <>
          {etat.groupes.length < 2 && (
            <p style={{ fontSize: 13, color: "var(--lc-text-muted, #475569)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {t("shell.myClasses.intro")}
            </p>
          )}
          <div style={{ display: "grid", gap: 14 }}>
            {etat.groupes.map((g) => (
              <Card key={g.compteId} style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15, color: "var(--lc-text)" }}>🏫 {g.nom}</strong>
                  {g.actuel && <Badge color="green">{t("shell.myClasses.here")}</Badge>}
                </div>
                {g.classes.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>{t("shell.myClasses.noClass")}</span>
                    {!g.actuel && (
                      <Btn sm v="ghost" disabled={!!ouverture} onClick={() => ouvrir(g, null, g.compteId)}>
                        {ouverture === g.compteId ? t("shell.myClasses.opening") : t("shell.myClasses.openSchool")}
                      </Btn>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                    {g.classes.map((c) => {
                      const cle = `${g.compteId}:${c.id}`;
                      return (
                        <button key={c.id} type="button" disabled={!!ouverture}
                          onClick={() => ouvrir(g, moduleDeSection(c.section), cle)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, textAlign: "start",
                            padding: "11px 13px", borderRadius: 10, cursor: ouverture ? "wait" : "pointer",
                            border: "1px solid var(--lc-border, #e2e8f0)", background: "var(--lc-surface-alt, #f8fafc)",
                            color: "var(--lc-text)",
                          }}>
                          <span style={{ fontSize: 14, fontWeight: 800 }}>{c.nom}</span>
                          <span style={{ fontSize: 11.5, color: "var(--lc-text-muted, #64748b)" }}>
                            {libelleSection(c.section)} · {t("shell.myClasses.students", { count: c.effectif })}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.blue }}>
                            {ouverture === cle ? t("shell.myClasses.opening") : `${t("shell.myClasses.open")} →`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <EtatRattachement groupe={g} t={t} occupe={!!ouverture || annulation}
                  onDemander={() => setDemande(g)} onAnnuler={annuler} />
              </Card>
            ))}
          </div>
        </>
      )}

      {ajout && (
        <AjoutEtablissementModale
          fermer={() => setAjout(false)}
          onAjoute={(nom) => {
            toast(t("shell.myClasses.added", { nom }), "success");
            setAjout(false);
            recharger();
          }}
        />
      )}

      {demande && (
        <DemandeRattachementModale
          etablissement={demande.nom}
          fermer={() => setDemande(null)}
          onEnvoyee={(ecole) => {
            toast(t("rattachement.sent", { ecole }), "success");
            setDemande(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}
